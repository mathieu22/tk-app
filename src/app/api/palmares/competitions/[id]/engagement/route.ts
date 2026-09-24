// Liste d'engagement d'une compétition (US-5.5 S) : athlète, naissance, catégorie d'âge, poids, grade, licence.
// PDF par défaut ; ?format=xlsx pour l'export Excel.
import { notFound } from "next/navigation";
import { currentGrades, gradeShortLabel } from "@/lib/grades";
import { competitionProfile } from "@/lib/categories";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { PdfWriter, xlsxResponse } from "@/lib/export";
import { formatDate } from "@/lib/format";
import { seasonForCompetition } from "@/app/(app)/palmares/data";

export async function GET(req: Request, ctx: RouteContext<"/api/palmares/competitions/[id]/engagement">) {
  await requirePermission("palmares.manage");
  const { id } = await ctx.params;
  const competition = await db.competition.findUnique({
    where: { id },
    include: { results: { select: { memberId: true } }, event: { include: { registrations: { where: { response: "YES" } } } } },
  });
  if (!competition) notFound();
  const association = await getAssociation();

  const memberIds = [...new Set([...competition.results.map((r) => r.memberId), ...(competition.event?.registrations.map((r) => r.memberId) ?? [])])];
  const [members, season, grades] = await Promise.all([
    db.member.findMany({ where: { id: { in: memberIds } }, include: { weighIns: { orderBy: { date: "desc" }, take: 1 } } }),
    seasonForCompetition(competition),
    currentGrades(memberIds),
  ]);
  members.sort((a, b) => a.lastName.localeCompare(b.lastName));

  const rows = members.map((m) => {
    const p = season ? competitionProfile(season, m, m.weighIns[0] ?? null, { alertKg: association.weightAlertKg, maxDays: association.weighInMaxDays, at: competition.startDate }) : null;
    const grade = grades.get(m.id)?.grade;
    return {
      matricule: m.matricule, name: fullName(m), birth: formatDate(m.birthDate),
      ageCategory: p?.ageCategory ?? "", weightCategory: p?.weightCategory ?? "",
      grade: grade ? `${grade.beltLabel} (${gradeShortLabel(grade)})` : "", license: m.licenseNo ?? "",
    };
  });

  const format = new URL(req.url).searchParams.get("format");
  if (format === "xlsx") {
    return xlsxResponse(`engagement-${competition.name}.xlsx`, [{
      name: "Engagement",
      columns: [
        { header: "Matricule", key: "matricule" }, { header: "Athlète", key: "name", width: 24 }, { header: "Naissance", key: "birth" },
        { header: "Cat. âge", key: "ageCategory" }, { header: "Cat. poids", key: "weightCategory" }, { header: "Grade", key: "grade", width: 26 },
        { header: "N° licence", key: "license" },
      ],
      rows,
    }]);
  }

  const pdf = await PdfWriter.create();
  pdf.text(association.name, { size: 12, bold: true, color: [0.106, 0.369, 0.125] });
  pdf.gap(6);
  pdf.text(`LISTE D'ENGAGEMENT — ${competition.name.toUpperCase()}`, { size: 15, bold: true });
  pdf.keyValue("Date", formatDate(competition.startDate));
  if (competition.location) pdf.keyValue("Lieu", competition.location);
  pdf.gap(10);
  pdf.table(
    ["Athlète", "Naissance", "Cat. âge", "Cat. poids", "Grade", "Licence"],
    rows.map((r) => [r.name, r.birth, r.ageCategory, r.weightCategory, r.grade, r.license]),
    [140, 65, 75, 65, 100, 50],
  );
  return pdf.response(`engagement-${competition.startDate.toISOString().slice(0, 10)}.pdf`, true);
}
