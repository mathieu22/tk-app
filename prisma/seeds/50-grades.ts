// Correspondance Enfant → Adulte (question ouverte n°1) et passages de grade de démonstration.
import type { PrismaClient } from "../../src/generated/prisma/client";

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

export async function seed(db: PrismaClient) {
  const [enfant, adulte] = await Promise.all([
    db.gradeGrid.findUnique({ where: { name: "Enfant" }, include: { grades: { where: { kind: "KEUP" } } } }),
    db.gradeGrid.findUnique({ where: { name: "Adulte" }, include: { grades: { where: { kind: "KEUP" } } } }),
  ]);
  if (!enfant || !adulte) return;

  // Proposition de correspondance pour les keup 15 à 7 (à partir du 6e keup, les grilles sont identiques).
  // Ex. retenu par le spec : Orange 12e keup enfant → Jaune 9e keup adulte.
  const pairs: [child: number, adult: number][] = [
    [15, 10], [14, 10], [13, 9], [12, 9], [11, 8], [10, 8], [9, 7], [8, 7], [7, 6],
  ];
  for (const [childNum, adultNum] of pairs) {
    const child = enfant.grades.find((g) => g.number === childNum);
    const adult = adulte.grades.find((g) => g.number === adultNum);
    if (!child || !adult) continue;
    await db.gradeMapping.upsert({
      where: { childGradeId: child.id },
      update: { adultGradeId: adult.id },
      create: { childGradeId: child.id, adultGradeId: adult.id },
    });
  }

  if ((await db.gradePassage.count()) > 0) return;

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
