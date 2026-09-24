// Logique d'import du fichier des athlètes (US-2.6) : lecture du classeur, reconnaissance
// de colonnes, normalisation, correspondances et détection d'erreurs / doublons.
// Aucun accès DB direct : les vérifications de doublons se font contre une liste
// `existing` fournie par l'appelant (voir src/app/api/membres/import/route.ts).
import "server-only";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import { BLOOD_GROUPS, MEMBER_STATUSES, POSITIONS, SEXES, type Position } from "./domain";
import { normalizePhone } from "./format";

/** Une cellule d'un classeur peut être une chaîne, un nombre (dates Excel), une Date, ou un objet enrichi. */
function cellToRaw(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text; // texte enrichi
    if ("result" in value) return cellToRaw(value.result as ExcelJS.CellValue); // formule
    if ("hyperlink" in value) return String((value as { text?: string }).text ?? value.hyperlink);
  }
  return String(value).trim();
}

/** Lit un fichier .xlsx/.xls ou .csv et renvoie l'en-tête et les lignes en texte brut. */
export async function parseSpreadsheet(buffer: Buffer, filename: string): Promise<{ headers: string[]; rows: string[][] }> {
  const wb = new ExcelJS.Workbook();
  if (/\.csv$/i.test(filename)) await wb.csv.read(Readable.from(buffer));
  // `as any` : le .d.ts d'exceljs redéclare globalement `interface Buffer extends ArrayBuffer {}`,
  // ce qui — combiné au lib "esnext" du tsconfig (ArrayBuffer redimensionnable) — rend tout Buffer
  // Node réel structurellement incompatible avec son propre type `Buffer` attendu ici. Bug connu
  // des typages d'exceljs ; sans impact à l'exécution (buffer est un vrai Buffer Node).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  else await wb.xlsx.load(buffer as any);
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };
  const rows: string[][] = [];
  let headers: string[] = [];
  ws.eachRow((row, rowNumber) => {
    // exceljs indexe les colonnes à partir de 1 ; row.values[0] est toujours vide.
    const cells = (row.values as ExcelJS.CellValue[]).slice(1).map(cellToRaw);
    if (rowNumber === 1) headers = cells;
    else if (cells.some((c) => c !== "")) rows.push(cells);
  });
  return { headers, rows };
}

export const EXPECTED_COLUMNS = [
  "Id", "Noms", "Prénoms", "Sexe", "Date_Naissance", "Lieu_Naissance", "Nationalite",
  "Groupe_Sangin", "Adresse", "Contact", "TUTEUR1", "TUTEUR2", "Mail", "FB",
  "Date_inscription", "Statut", "Poste",
] as const;
export type ColumnKey = (typeof EXPECTED_COLUMNS)[number];
export const REQUIRED_COLUMNS: ColumnKey[] = ["Noms", "Prénoms", "Sexe", "Date_Naissance"];

function normKey(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const ALIASES: Record<ColumnKey, string[]> = {
  Id: ["id", "matricule"],
  Noms: ["noms", "nom"],
  "Prénoms": ["prenoms", "prenom"],
  Sexe: ["sexe", "genre"],
  Date_Naissance: ["datenaissance", "ddn", "birthdate", "dtnaissance"],
  Lieu_Naissance: ["lieunaissance", "lieudenaissance"],
  Nationalite: ["nationalite"],
  Groupe_Sangin: ["groupesanguin", "groupesangin"],
  Adresse: ["adresse"],
  Contact: ["contact", "telephone", "tel", "phone"],
  TUTEUR1: ["tuteur1", "tuteur"],
  TUTEUR2: ["tuteur2"],
  Mail: ["mail", "email"],
  FB: ["fb", "facebook"],
  Date_inscription: ["dateinscription", "datinscription"],
  Statut: ["statut", "status"],
  Poste: ["poste", "fonction", "role"],
};

/** Reconnaissance automatique des colonnes (insensible à la casse, aux accents et aux séparateurs). */
export function detectColumns(headers: string[]): Partial<Record<ColumnKey, string>> {
  const map: Partial<Record<ColumnKey, string>> = {};
  for (const key of EXPECTED_COLUMNS) {
    const found = headers.find((h) => ALIASES[key].includes(normKey(h)));
    if (found) map[key] = found;
  }
  return map;
}

// ── Dates ──
const DATE_RE_FR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/; // JJ/MM/AAAA
const DATE_RE_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/; // AAAA-MM-JJ

/** Excel stocke les dates en nombre de jours depuis le 30/12/1899. */
const excelSerialToDate = (n: number) => new Date(Math.round((n - 25569) * 86400 * 1000));

export function parseFlexibleDate(raw: string | number | Date | null | undefined): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "number") return excelSerialToDate(raw);
  const s = String(raw ?? "").trim();
  if (!s) return null;
  let m = DATE_RE_FR.exec(s);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return d.getMonth() === Number(m[2]) - 1 ? d : null; // rejette 32/13/2020
  }
  m = DATE_RE_ISO.exec(s);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.getMonth() === Number(m[2]) - 1 ? d : null;
  }
  if (/^\d{4,6}(\.\d+)?$/.test(s)) return excelSerialToDate(Number(s)); // numéro de série Excel en texte
  return null;
}

// ── Correspondances Sexe / Statut / Poste (proposition, US-2.6) ──
function suggest<T extends string>(raw: string, dict: Record<T, string[]>): T | null {
  const n = normKey(raw);
  if (!n) return null;
  for (const key of Object.keys(dict) as T[]) if (dict[key].some((alias) => normKey(alias) === n)) return key;
  return null;
}

const SEX_ALIASES: Record<keyof typeof SEXES, string[]> = {
  M: ["m", "masculin", "homme", "h", "garcon"],
  F: ["f", "feminin", "femme", "fille"],
};
export const suggestSex = (raw: string) => suggest(raw, SEX_ALIASES);

const STATUS_ALIASES: Record<keyof typeof MEMBER_STATUSES, string[]> = {
  ACTIVE: ["actif", "active", "a"],
  INACTIVE: ["inactif", "inactive", "i"],
  SUSPENDED: ["suspendu", "suspendue"],
  FORMER: ["ancienmembre", "ancien", "ancienne", "anciens"],
};
export const suggestStatus = (raw: string) => suggest(raw, STATUS_ALIASES);

const POSITION_ALIASES: Record<Position, string[]> = {
  PRESIDENT: ["president", "presidente"],
  VICE_PRESIDENT: ["vicepresident", "vicepresidente"],
  SECRETARY: ["secretaire", "secretairegenerale"],
  TREASURER: ["tresorier", "tresoriere"],
  COACH: ["entraineur", "entraineuse", "coach"],
  ATHLETE: ["athlete", "membre", "eleve", "elève"],
};
export const suggestPosition = (raw: string) => suggest(raw, POSITION_ALIASES);

export function suggestBloodGroup(raw: string): (typeof BLOOD_GROUPS)[number] | null {
  const n = raw.trim().toUpperCase().replace(/\s/g, "");
  return (BLOOD_GROUPS as readonly string[]).includes(n) ? (n as (typeof BLOOD_GROUPS)[number]) : n === "" ? "Inconnu" : null;
}

// ── Tuteurs (texte libre → nom + téléphone) ──
const PHONE_IN_TEXT = /(\+?261[\s.-]?)?0?3[2-8][\s.-]?\d{2}[\s.-]?\d{3}[\s.-]?\d{2}\b/;

export type TutorGuess = { name: string; phone: string | null };

export function parseTutorText(raw: string): TutorGuess | null {
  const s = raw.trim();
  if (!s) return null;
  const m = PHONE_IN_TEXT.exec(s);
  const phone = m ? normalizePhone(m[0]) : null;
  const name = s.replace(PHONE_IN_TEXT, "").replace(/[()–-]/g, " ").replace(/\s+/g, " ").trim();
  return { name: name || s, phone };
}

// ── Validation d'une ligne ──
export type ImportRowInput = { rowNumber: number; values: Partial<Record<ColumnKey, string>> };
export type ImportIssue = { field: string; message: string; suggestion?: string };

export type ImportRow = {
  rowNumber: number;
  matricule: string | null;
  lastName: string;
  firstName: string;
  sex: string | null;
  birthDate: string | null; // ISO AAAA-MM-JJ
  birthPlace: string;
  nationality: string;
  bloodGroup: string | null;
  address: string;
  phone: string | null;
  email: string;
  facebook: string;
  joinedAt: string | null;
  status: string;
  position: string;
  tutor1: TutorGuess | null;
  tutor2: TutorGuess | null;
  issues: ImportIssue[];
  duplicateOf: string | null; // matricule d'un doublon détecté en base
  importable: boolean;
};

export type ExistingMember = { matricule: string; lastName: string; firstName: string; birthDate: Date; phone: string | null };

/** Valide et normalise les lignes d'un import, avec détection de doublons (fichier + base, US-2.6). */
export function validateRows(rows: ImportRowInput[], existing: ExistingMember[]): ImportRow[] {
  const seenInFile = new Map<string, number>();
  return rows.map((row) => {
    const v = row.values;
    const issues: ImportIssue[] = [];
    const get = (k: ColumnKey) => (v[k] ?? "").toString().trim();

    const lastName = get("Noms").toUpperCase();
    const firstName = get("Prénoms").replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
    if (!lastName) issues.push({ field: "Noms", message: "Nom manquant" });
    if (!firstName) issues.push({ field: "Prénoms", message: "Prénom manquant" });

    const sexRaw = get("Sexe");
    const sex = sexRaw && sexRaw.toUpperCase() in SEXES ? sexRaw.toUpperCase() : suggestSex(sexRaw);
    if (!sexRaw) issues.push({ field: "Sexe", message: "Sexe manquant" });
    else if (!sex) issues.push({ field: "Sexe", message: `Valeur « ${sexRaw} » inconnue` });
    else if (sex !== sexRaw.toUpperCase()) issues.push({ field: "Sexe", message: `« ${sexRaw} » interprété comme ${SEXES[sex as keyof typeof SEXES]}`, suggestion: sex });

    const birthRaw = get("Date_Naissance");
    const birthDate = parseFlexibleDate(birthRaw);
    if (!birthRaw) issues.push({ field: "Date_Naissance", message: "Date de naissance manquante" });
    else if (!birthDate) issues.push({ field: "Date_Naissance", message: `Date invalide : « ${birthRaw} »` });

    const joinedRaw = get("Date_inscription");
    const joinedAt = joinedRaw ? parseFlexibleDate(joinedRaw) : new Date();
    if (joinedRaw && !joinedAt) issues.push({ field: "Date_inscription", message: `Date invalide : « ${joinedRaw} »` });

    const phoneRaw = get("Contact");
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phoneRaw && !phone) issues.push({ field: "Contact", message: `Téléphone mal formé : « ${phoneRaw} »` });

    const statusRaw = get("Statut") || "Actif";
    const status = statusRaw.toUpperCase() in MEMBER_STATUSES ? statusRaw.toUpperCase() : suggestStatus(statusRaw);
    if (!status) issues.push({ field: "Statut", message: `Statut « ${statusRaw} » inconnu` });
    else if (status !== statusRaw.toUpperCase()) issues.push({ field: "Statut", message: `« ${statusRaw} » interprété comme ${MEMBER_STATUSES[status as keyof typeof MEMBER_STATUSES]}`, suggestion: status });

    const posRaw = get("Poste") || "Athlète";
    const position = posRaw.toUpperCase() in POSITIONS ? posRaw.toUpperCase() : suggestPosition(posRaw);
    if (!position) issues.push({ field: "Poste", message: `Poste « ${posRaw} » inconnu` });
    else if (position !== posRaw.toUpperCase()) issues.push({ field: "Poste", message: `« ${posRaw} » interprété comme ${POSITIONS[position as Position]}`, suggestion: position });

    const bloodRaw = get("Groupe_Sangin");
    const bloodGroup = suggestBloodGroup(bloodRaw);
    if (bloodRaw && !bloodGroup) issues.push({ field: "Groupe_Sangin", message: `Groupe sanguin « ${bloodRaw} » inconnu`, suggestion: "Inconnu" });

    const emailRaw = get("Mail");
    if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) issues.push({ field: "Mail", message: `Email invalide : « ${emailRaw} »` });

    // Doublons : même nom + prénom + naissance, ou même téléphone (dans le fichier, puis en base)
    const dupKey = birthDate ? `${lastName}|${firstName}|${birthDate.toDateString()}` : null;
    let duplicateOf: string | null = null;
    if (dupKey && seenInFile.has(dupKey)) {
      issues.push({ field: "Noms", message: `Doublon avec la ligne ${seenInFile.get(dupKey)}` });
    } else {
      const exist = existing.find(
        (e) =>
          (birthDate && e.lastName === lastName && e.firstName === firstName && e.birthDate.toDateString() === birthDate.toDateString()) ||
          (phone && e.phone === phone),
      );
      if (exist) {
        duplicateOf = exist.matricule;
        issues.push({ field: "Noms", message: `Doublon possible avec ${exist.matricule}` });
      }
    }
    if (dupKey) seenInFile.set(dupKey, row.rowNumber);

    const blockingFields = ["Noms", "Prénoms", "Sexe", "Date_Naissance", "Statut", "Poste", "Contact", "Mail"];
    const blocking = issues.some((i) => !i.suggestion && blockingFields.includes(i.field));

    return {
      rowNumber: row.rowNumber,
      matricule: get("Id") || null,
      lastName, firstName,
      sex: sex ?? null,
      birthDate: birthDate ? birthDate.toISOString().slice(0, 10) : null,
      birthPlace: get("Lieu_Naissance"),
      nationality: get("Nationalite") || "Malagasy",
      bloodGroup: bloodGroup ?? null,
      address: get("Adresse"),
      phone,
      email: emailRaw,
      facebook: get("FB"),
      joinedAt: joinedAt ? joinedAt.toISOString().slice(0, 10) : null,
      status: status ?? "ACTIVE",
      position: position ?? "ATHLETE",
      tutor1: parseTutorText(get("TUTEUR1")),
      tutor2: parseTutorText(get("TUTEUR2")),
      issues,
      duplicateOf,
      importable: !blocking && !duplicateOf,
    };
  });
}

/**
 * Revalidation côté serveur juste avant l'écriture (US-2.6) : ne jamais faire confiance
 * aux champs déjà résolus renvoyés par le client (édition manuelle dans l'aperçu, ou falsification).
 * Recontrôle les invariants et recalcule les doublons contre l'état actuel de la base.
 */
export function revalidateResolved(rows: ImportRow[], existing: ExistingMember[]): ImportRow[] {
  const seenInFile = new Map<string, number>();
  return rows.map((r) => {
    const issues: ImportIssue[] = [];
    if (!r.lastName.trim()) issues.push({ field: "Noms", message: "Nom manquant" });
    if (!r.firstName.trim()) issues.push({ field: "Prénoms", message: "Prénom manquant" });
    if (!r.sex || !(r.sex in SEXES)) issues.push({ field: "Sexe", message: "Sexe invalide" });
    const birthDate = r.birthDate ? new Date(`${r.birthDate}T00:00:00`) : null;
    if (!birthDate || Number.isNaN(birthDate.getTime())) issues.push({ field: "Date_Naissance", message: "Date de naissance invalide" });
    if (!(r.status in MEMBER_STATUSES)) issues.push({ field: "Statut", message: "Statut invalide" });
    if (!(r.position in POSITIONS)) issues.push({ field: "Poste", message: "Poste invalide" });
    if (r.phone && !normalizePhone(r.phone)) issues.push({ field: "Contact", message: "Téléphone invalide" });
    if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) issues.push({ field: "Mail", message: "Email invalide" });

    const dupKey = birthDate && !Number.isNaN(birthDate.getTime()) ? `${r.lastName}|${r.firstName}|${birthDate.toDateString()}` : null;
    let duplicateOf: string | null = null;
    if (dupKey && seenInFile.has(dupKey)) {
      issues.push({ field: "Noms", message: `Doublon avec la ligne ${seenInFile.get(dupKey)}` });
    } else {
      const exist = existing.find(
        (e) =>
          (dupKey && birthDate && e.lastName === r.lastName && e.firstName === r.firstName && e.birthDate.toDateString() === birthDate.toDateString()) ||
          (r.phone && e.phone === r.phone),
      );
      if (exist) {
        duplicateOf = exist.matricule;
        issues.push({ field: "Noms", message: `Doublon possible avec ${exist.matricule}` });
      }
    }
    if (dupKey) seenInFile.set(dupKey, r.rowNumber);

    return { ...r, issues, duplicateOf, importable: issues.length === 0 };
  });
}

/** Fusionne les tuteurs identiques (même téléphone) apparaissant plusieurs fois dans le fichier. */
export function mergeTutorGuesses(rows: ImportRow[]): Map<string, TutorGuess> {
  const byPhone = new Map<string, TutorGuess>();
  for (const r of rows) {
    for (const t of [r.tutor1, r.tutor2]) if (t?.phone && !byPhone.has(t.phone)) byPhone.set(t.phone, t);
  }
  return byPhone;
}

/** Résumé pour le compte rendu final (US-2.6). */
export function summarize(rows: ImportRow[]) {
  const imported = rows.filter((r) => r.importable).length;
  const duplicates = rows.filter((r) => r.duplicateOf).length;
  const toFix = rows.length - imported - duplicates;
  return { total: rows.length, imported, duplicates, toFix };
}
