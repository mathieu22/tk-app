// Export de la liste des participants d'un événement en PDF ou Excel (US-1.10 C).
// /api/evenements/[id]/export?format=xlsx|pdf (défaut : xlsx). Utile pour les feuilles d'engagement.
import { NextResponse, type NextRequest } from "next/server";
import { audienceParentsWhere, audienceWhere } from "@/lib/attendance";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { fullName, POSITIONS, type Position } from "@/lib/domain";
import { PdfWriter, xlsxResponse } from "@/lib/export";
import { formatDate } from "@/lib/format";

export async function GET(req: NextRequest, props: RouteContext<"/api/evenements/[id]/export">) {
  const user = await getCurrentUser();
  if (!user?.perms.includes("attendance.viewAll")) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { id } = await props.params;
  const event = await db.event.findUnique({ where: { id }, include: { type: true, registrations: { include: { member: true } } } });
  if (!event) return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });

  type Row = { name: string; role: string; birthDate?: Date; licenseNo?: string | null; response: string };
  let rows: Row[] = [];
  if (event.audience === "PARENTS") {
    const parents = await db.parent.findMany({ where: audienceParentsWhere(), orderBy: { lastName: "asc" } });
    rows = parents.map((p) => ({ name: `${p.firstName} ${p.lastName}`, role: "Parent", response: "—" }));
  } else if (event.participationMode === "OPEN") {
    const where = event.audience === "SELECTION" ? { id: { in: event.registrations.map((r) => r.memberId) } } : audienceWhere(event);
    const members = where ? await db.member.findMany({ where, orderBy: { lastName: "asc" } }) : [];
    rows = members.map((m) => ({ name: fullName(m), role: POSITIONS[m.position as Position] ?? m.position, birthDate: m.birthDate, licenseNo: m.licenseNo, response: "—" }));
  } else {
    rows = event.registrations.map((r) => ({
      name: fullName(r.member), role: POSITIONS[r.member.position as Position] ?? r.member.position,
      birthDate: r.member.birthDate, licenseNo: r.member.licenseNo, response: r.response,
    }));
  }

  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const filenameBase = `${event.title.replace(/[^\p{L}\p{N}]+/gu, "-")}-${formatDate(event.startDate).replace(/\//g, "-")}`;

  if (format === "pdf") {
    const pdf = await PdfWriter.create();
    pdf.text(event.title, { size: 18, bold: true });
    pdf.text(`${event.type.label} · ${formatDate(event.startDate)}${event.location ? ` · ${event.location}` : ""}`, { size: 10 });
    pdf.gap(10);
    pdf.table(
      ["Nom", "Date de naissance", "N° licence", "Statut"],
      rows.map((r) => [r.name, r.birthDate ? formatDate(r.birthDate) : "—", r.licenseNo ?? "—", r.response === "YES" ? "Participe" : r.response === "NO" ? "Ne participe pas" : r.response === "MAYBE" ? "Peut-être" : r.response]),
      [220, 110, 90, 95],
    );
    return pdf.response(`${filenameBase}.pdf`);
  }

  return xlsxResponse(`${filenameBase}.xlsx`, [{
    name: "Participants",
    columns: [
      { header: "Nom", key: "name", width: 30 },
      { header: "Rôle", key: "role", width: 16 },
      { header: "Date de naissance", key: "birth", width: 16 },
      { header: "N° licence", key: "license", width: 14 },
      { header: "Statut", key: "status", width: 16 },
    ],
    rows: rows.map((r) => ({
      name: r.name, role: r.role, birth: r.birthDate ? formatDate(r.birthDate) : "",
      license: r.licenseNo ?? "", status: r.response === "YES" ? "Participe" : r.response === "NO" ? "Ne participe pas" : r.response === "MAYBE" ? "Peut-être" : r.response,
    })),
  }]);
}
