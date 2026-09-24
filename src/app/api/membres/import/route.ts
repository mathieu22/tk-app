// Import du fichier des athlètes (US-2.6). Une route API (pas une Server Action) : les fichiers
// Excel/CSV dépassent facilement la limite de 1 Mo appliquée aux Server Actions.
//
//  POST multipart/form-data { file, columnMap? } → aperçu : en-têtes, correspondance de colonnes,
//    lignes validées (avec erreurs / doublons / suggestions), sans écriture en base.
//  POST application/json { rows: ImportRow[] } → écrit en base les lignes envoyées, après les avoir
//    revalidées côté serveur (jamais confiance dans les indicateurs calculés côté client).
import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/app/api/membres/_auth";
import { db } from "@/lib/db";
import {
  detectColumns, EXPECTED_COLUMNS, parseSpreadsheet, REQUIRED_COLUMNS, revalidateResolved, summarize, validateRows,
  type ColumnKey, type ExistingMember, type ImportRow, type ImportRowInput,
} from "@/lib/import-members";
import { newQrToken } from "@/lib/qr";

export const runtime = "nodejs";
const MAX_ROWS = 5000;

async function loadExisting(): Promise<ExistingMember[]> {
  return db.member.findMany({
    where: { archived: false },
    select: { matricule: true, lastName: true, firstName: true, birthDate: true, phone: true },
  });
}

async function handleParse(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Fichier trop volumineux (8 Mo maximum)." }, { status: 413 });

  let headers: string[], rawRows: string[][];
  try {
    ({ headers, rows: rawRows } = await parseSpreadsheet(Buffer.from(await file.arrayBuffer()), file.name));
  } catch {
    return NextResponse.json({ error: "Fichier illisible : vérifiez qu'il s'agit bien d'un .xlsx ou d'un .csv." }, { status: 400 });
  }
  if (rawRows.length > MAX_ROWS) return NextResponse.json({ error: `${MAX_ROWS} lignes maximum par import.` }, { status: 413 });

  const overrideRaw = form.get("columnMap");
  let columnMap = detectColumns(headers);
  if (typeof overrideRaw === "string") {
    try {
      const override = JSON.parse(overrideRaw) as Partial<Record<ColumnKey, string>>;
      columnMap = { ...columnMap, ...Object.fromEntries(Object.entries(override).filter(([, v]) => v)) };
    } catch {
      return NextResponse.json({ error: "Correspondance de colonnes invalide." }, { status: 400 });
    }
  }
  const missingRequired = REQUIRED_COLUMNS.filter((k) => !columnMap[k]);

  if (missingRequired.length > 0) {
    // Le fichier ne suit pas le format attendu : demander la correspondance colonne → champ (US-2.6).
    return NextResponse.json({ step: "mapping", headers, columnMap, missingRequired, expected: EXPECTED_COLUMNS, rowCount: rawRows.length });
  }

  const inputs: ImportRowInput[] = rawRows.map((cells, i) => ({
    rowNumber: i + 2, // ligne 1 = en-tête
    values: Object.fromEntries(
      (Object.entries(columnMap) as [ColumnKey, string][]).map(([key, header]) => [key, cells[headers.indexOf(header)] ?? ""]),
    ),
  }));
  const existing = await loadExisting();
  const rows = validateRows(inputs, existing);
  return NextResponse.json({ step: "preview", headers, columnMap, rows, summary: summarize(rows) });
}

/** Sépare un nom libre "Marie Rakoto" en prénom / nom (premier mot = prénom). */
function splitTutorName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? { firstName: parts[0], lastName: parts.slice(1).join(" ") } : { firstName: parts[0] ?? "Tuteur", lastName: parts[0] ?? "" };
}

async function nextMatriculeSeq() {
  const last = await db.member.findFirst({ where: { matricule: { startsWith: "ATH-" } }, orderBy: { matricule: "desc" }, select: { matricule: true } });
  return last ? Number(last.matricule.slice(4)) + 1 : 1;
}

type CommitReport = {
  imported: number;
  skipped: { rowNumber: number; name: string; reasons: string[] }[];
  tutorsLinked: number;
  tutorsSkipped: number;
};

async function handleCommit(req: NextRequest, userId: string) {
  let body: { rows?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0) return NextResponse.json({ error: "Aucune ligne à importer." }, { status: 400 });
  if (body.rows.length > MAX_ROWS) return NextResponse.json({ error: `${MAX_ROWS} lignes maximum par import.` }, { status: 413 });

  const existing = await loadExisting();
  const revalidated = revalidateResolved(body.rows as ImportRow[], existing);

  const report: CommitReport = { imported: 0, skipped: [], tutorsLinked: 0, tutorsSkipped: 0 };
  const usedMatricules = new Set(existing.map((e) => e.matricule));
  let seq = await nextMatriculeSeq();

  for (const row of revalidated) {
    const label = `${row.firstName} ${row.lastName}`.trim() || `ligne ${row.rowNumber}`;
    if (!row.importable) {
      report.skipped.push({ rowNumber: row.rowNumber, name: label, reasons: row.issues.map((i) => i.message) });
      continue;
    }
    let matricule = row.matricule?.trim();
    if (!matricule || usedMatricules.has(matricule)) {
      do matricule = `ATH-${String(seq++).padStart(4, "0")}`; while (usedMatricules.has(matricule));
    }
    usedMatricules.add(matricule);

    try {
      await db.$transaction(async (tx) => {
        const member = await tx.member.create({
          data: {
            matricule, lastName: row.lastName, firstName: row.firstName, sex: row.sex!,
            birthDate: new Date(`${row.birthDate}T00:00:00`), birthPlace: row.birthPlace || null,
            nationality: row.nationality || "Malagasy", bloodGroup: row.bloodGroup, address: row.address || null,
            phone: row.phone, email: row.email || null, facebook: row.facebook || null,
            joinedAt: row.joinedAt ? new Date(`${row.joinedAt}T00:00:00`) : new Date(),
            status: row.status, position: row.position, qrToken: newQrToken(),
          },
        });
        for (const [rank, tutor] of [[1, row.tutor1], [2, row.tutor2]] as const) {
          if (!tutor) continue;
          if (!tutor.phone) { report.tutorsSkipped++; continue; } // impossible de créer une fiche parent sans téléphone
          const { firstName, lastName } = splitTutorName(tutor.name);
          const parent = await tx.parent.upsert({
            where: { phone: tutor.phone },
            update: {},
            create: { firstName, lastName: lastName.toUpperCase(), phone: tutor.phone },
          });
          await tx.parentLink.upsert({
            where: { parentId_memberId: { parentId: parent.id, memberId: member.id } },
            update: { rank },
            create: { parentId: parent.id, memberId: member.id, relationship: "OTHER", rank },
          });
          report.tutorsLinked++;
        }
      });
      report.imported++;
    } catch (e) {
      report.skipped.push({ rowNumber: row.rowNumber, name: label, reasons: [`Erreur d'enregistrement : ${e instanceof Error ? e.message : "inconnue"}`] });
    }
  }

  await db.auditLog.create({
    data: { userId, action: "member.import", entity: "Member", details: `${report.imported} importés, ${report.skipped.length} ignorés` },
  });
  return NextResponse.json(report);
}

export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("member.import");
  if (!auth.user) return auth.error;
  const contentType = req.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? handleCommit(req, auth.user.id) : handleParse(req);
}
