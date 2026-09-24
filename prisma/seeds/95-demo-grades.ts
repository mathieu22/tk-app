// Passages de grade de démonstration (EPIC 4). Ne s'exécute qu'avec SEED_DEMO=1.
import type { PrismaClient } from "../../src/generated/prisma/client";

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

export async function seed(db: PrismaClient) {
  if (process.env.SEED_DEMO !== "1") return;
  if ((await db.gradePassage.count()) > 0) return;

  const enfant = await db.gradeGrid.findUnique({ where: { name: "Enfant" }, include: { grades: { where: { kind: "KEUP" } } } });
  if (!enfant) return;

  const demo: { matricule: string; childNumber: number; monthsAgo: number; jury: string; mention?: string }[] = [
    { matricule: "ATH-0003", childNumber: 13, monthsAgo: 8, jury: "Njaka Razafindrakoto", mention: "Bien" },
    { matricule: "ATH-0005", childNumber: 12, monthsAgo: 40, jury: "Njaka Razafindrakoto", mention: "Assez bien" },
  ];
  for (const d of demo) {
    const member = await db.member.findUnique({ where: { matricule: d.matricule } });
    const grade = enfant.grades.find((g) => g.number === d.childNumber);
    if (!member || !grade) continue;
    await db.gradePassage.create({
      data: { memberId: member.id, gradeId: grade.id, date: monthsAgo(d.monthsAgo), jury: d.jury, mention: d.mention },
    });
  }
}
