// Export Excel des grades actuels et de l'éligibilité (US-4.5).
import { gradeSummaries } from "@/app/(app)/grades/data";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { xlsxResponse } from "@/lib/export";
import { formatDate } from "@/lib/format";
import { gradeShortLabel } from "@/lib/grades";

export async function GET() {
  await requirePermission("grade.manage");
  const members = await db.member.findMany({
    where: { archived: false, status: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, matricule: true, firstName: true, lastName: true, birthDate: true, groupId: true, joinedAt: true },
  });
  const s = await gradeSummaries(members);
  return xlsxResponse("grades.xlsx", [{
    name: "Grades",
    columns: [
      { header: "Matricule", key: "matricule" }, { header: "Nom(s)", key: "lastName", width: 22 }, { header: "Prénom(s)", key: "firstName", width: 18 },
      { header: "Grille", key: "grid" }, { header: "Grade actuel", key: "grade", width: 30 }, { header: "Depuis", key: "since" },
      { header: "Grade suivant", key: "next", width: 30 }, { header: "Éligible", key: "eligible" }, { header: "Motif", key: "reason", width: 24 },
      { header: "Présence 12 mois (%)", key: "pct" },
    ],
    rows: members.map((m) => {
      const x = s.get(m.id)!;
      return {
        matricule: m.matricule, lastName: m.lastName, firstName: m.firstName, grid: x.gridName,
        grade: x.passage ? `${x.passage.grade.beltLabel} (${gradeShortLabel(x.passage.grade)})` : "",
        since: x.passage ? formatDate(x.passage.date) : "",
        next: x.next ? `${x.next.beltLabel} (${gradeShortLabel(x.next)})` : "",
        eligible: x.passage && x.next ? (x.eligible ? "Oui" : "Non") : "",
        reason: x.reasons.join(", "), pct: x.attendancePct ?? "",
      };
    }),
  }]);
}
