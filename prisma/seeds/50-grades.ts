// Correspondance Enfant → Adulte (question ouverte n°1, EPIC 4). Référentiel : toujours chargé.
import type { PrismaClient } from "../../src/generated/prisma/client";

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
}
