// Export de la liste des présences d'une séance en PDF ou Excel (US-1.4 C).
// /api/sessions/[id]/export?format=xlsx|pdf (défaut : xlsx). Route hors du proxy : session vérifiée ici.
import { NextResponse, type NextRequest } from "next/server";
import { expectedMembersWhere, sessionStats } from "@/lib/attendance";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { fullName, POSITIONS, type Position } from "@/lib/domain";
import { PdfWriter, xlsxResponse } from "@/lib/export";
import { formatDate } from "@/lib/format";

export async function GET(req: NextRequest, props: RouteContext<"/api/sessions/[id]/export">) {
  const user = await getCurrentUser();
  if (!user?.perms.includes("attendance.viewAll")) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { id } = await props.params;
  const session = await db.session.findUnique({ where: { id }, include: { group: true } });
  if (!session) return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });

  const [expected, attendances] = await Promise.all([
    db.member.findMany({ where: expectedMembersWhere(session.groupId), orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.attendance.findMany({ where: { sessionId: id }, include: { member: true } }),
  ]);
  const byMember = new Map(attendances.map((a) => [a.memberId, a]));
  const extra = attendances.filter((a) => !expected.some((m) => m.id === a.memberId)).map((a) => a.member);
  const rows = [...expected, ...extra].map((m) => {
    const a = byMember.get(m.id);
    return { m, status: a?.status ?? "ABSENT", at: a?.scannedAt ?? null };
  });
  const st = (await sessionStats([session])).get(session.id)!;

  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const filenameBase = `${session.title.replace(/[^\p{L}\p{N}]+/gu, "-")}-${formatDate(session.date).replace(/\//g, "-")}`;
  const statusLabel = (s: string) => (s === "PRESENT" ? "Présent" : s === "EXCUSED" ? "Excusé" : "Absent");

  if (format === "pdf") {
    const pdf = await PdfWriter.create();
    pdf.text(session.title, { size: 18, bold: true });
    pdf.text(`${formatDate(session.date)}${session.startTime ? ` · ${session.startTime}` : ""}${session.location ? ` · ${session.location}` : ""}`, { size: 10 });
    pdf.gap(8);
    pdf.keyValue("Présents", `${st.present}`);
    pdf.keyValue("Absents", `${rows.length - st.present}`);
    pdf.keyValue("Taux de présence", `${st.pct} %`);
    pdf.gap(10);
    pdf.table(
      ["Nom", "Rôle", "Statut", "Heure"],
      rows.map((r) => [fullName(r.m), POSITIONS[r.m.position as Position] ?? r.m.position, statusLabel(r.status), r.at ? r.at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"]),
      [220, 120, 90, 65],
    );
    return pdf.response(`${filenameBase}.pdf`);
  }

  return xlsxResponse(`${filenameBase}.xlsx`, [{
    name: "Présences",
    columns: [
      { header: "Nom", key: "name", width: 26 },
      { header: "Prénom", key: "first", width: 18 },
      { header: "Rôle", key: "role", width: 16 },
      { header: "Statut", key: "status", width: 12 },
      { header: "Heure de scan", key: "at", width: 14 },
    ],
    rows: rows.map((r) => ({
      name: r.m.lastName, first: r.m.firstName, role: POSITIONS[r.m.position as Position] ?? r.m.position,
      status: statusLabel(r.status), at: r.at ? r.at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
    })),
  }]);
}
