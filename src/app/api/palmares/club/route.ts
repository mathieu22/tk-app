// Export PDF du palmarès du club (US-5.4).
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { PdfWriter } from "@/lib/export";
import { formatDate } from "@/lib/format";
import { DISCIPLINES, LEVEL_ORDER, LEVELS, medalCounts, outcomeLabel } from "@/app/(app)/palmares/data";

export async function GET() {
  await requirePermission("palmares.manage");
  const [association, results] = await Promise.all([
    getAssociation(),
    db.result.findMany({ include: { member: true, competition: true }, orderBy: { competition: { startDate: "desc" } } }),
  ]);

  const pdf = await PdfWriter.create();
  pdf.text(association.name, { size: 13, bold: true, color: [0.106, 0.369, 0.125] });
  pdf.gap(8);
  pdf.text("PALMARÈS DU CLUB", { size: 18, bold: true });
  pdf.gap(10);

  const byLevel = LEVEL_ORDER.map((l) => medalCounts(results.filter((r) => r.competition.level === l)));
  pdf.text("Médailles par niveau", { bold: true, size: 12 });
  pdf.table(["Niveau", "Or", "Argent", "Bronze"], LEVEL_ORDER.map((l, i) => [LEVELS[l], String(byLevel[i].gold), String(byLevel[i].silver), String(byLevel[i].bronze)]), [200, 90, 90, 90]);
  pdf.gap(14);

  const disciplines = Object.keys(DISCIPLINES) as (keyof typeof DISCIPLINES)[];
  pdf.text("Médailles par discipline", { bold: true, size: 12 });
  pdf.table(
    ["Discipline", "Or", "Argent", "Bronze"],
    disciplines.map((d) => {
      const m = medalCounts(results.filter((r) => r.discipline === d));
      return [DISCIPLINES[d], String(m.gold), String(m.silver), String(m.bronze)];
    }),
    [200, 90, 90, 90],
  );
  pdf.gap(14);

  pdf.text("Résultats détaillés", { bold: true, size: 12 });
  pdf.table(
    ["Date", "Compétition", "Athlète", "Épreuve", "Résultat"],
    results.slice(0, 200).map((r) => [
      formatDate(r.competition.startDate), r.competition.name, fullName(r.member),
      DISCIPLINES[r.discipline as keyof typeof DISCIPLINES] ?? r.discipline, outcomeLabel(r),
    ]),
    [55, 140, 120, 100, 80],
  );

  return pdf.response(`palmares-club-${new Date().toISOString().slice(0, 10)}.pdf`, true);
}
