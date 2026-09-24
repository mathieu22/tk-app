// Export Excel de tous les résultats (US-5.4/5.5).
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { xlsxResponse } from "@/lib/export";
import { formatDate } from "@/lib/format";
import { DISCIPLINES, LEVELS, outcomeLabel } from "@/app/(app)/palmares/data";

export async function GET() {
  await requirePermission("palmares.manage");
  const results = await db.result.findMany({ include: { member: true, competition: true }, orderBy: { competition: { startDate: "desc" } } });
  return xlsxResponse("palmares.xlsx", [{
    name: "Résultats",
    columns: [
      { header: "Date", key: "date" }, { header: "Compétition", key: "comp", width: 26 }, { header: "Niveau", key: "level" },
      { header: "Athlète", key: "name", width: 22 }, { header: "Épreuve", key: "discipline", width: 22 },
      { header: "Cat. âge", key: "age" }, { header: "Cat. poids", key: "weight" }, { header: "Résultat", key: "outcome" },
    ],
    rows: results.map((r) => ({
      date: formatDate(r.competition.startDate), comp: r.competition.name, level: LEVELS[r.competition.level as keyof typeof LEVELS] ?? r.competition.level,
      name: fullName(r.member), discipline: DISCIPLINES[r.discipline as keyof typeof DISCIPLINES] ?? r.discipline,
      age: r.ageCategory ?? "", weight: r.weightCategory ?? "", outcome: outcomeLabel(r),
    })),
  }]);
}
