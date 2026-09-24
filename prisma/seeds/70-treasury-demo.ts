// Démo trésorerie : recettes / dépenses sur les 3 derniers mois + un budget (EPIC 6).
// Ne s'exécute que si aucune opération n'existe encore (idempotent, comme les autres seeds).
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";

export async function seed(db: PrismaClient) {
  if ((await db.operation.count()) > 0) return;

  const [caisse, mvola, banque] = await Promise.all([
    db.treasuryAccount.findFirst({ where: { type: "CASH" } }),
    db.treasuryAccount.findFirst({ where: { operator: "MVOLA" } }),
    db.treasuryAccount.findFirst({ where: { type: "BANK" } }),
  ]);
  const cat = (name: string, type: "INCOME" | "EXPENSE") => db.operationCategory.findFirstOrThrow({ where: { name, type } });
  if (!caisse || !mvola || !banque) return; // seed 20-treasury.ts non exécuté

  const [subventions, dons, location, equipement, deplacements, arbitrage] = await Promise.all([
    cat("Subventions", "INCOME"),
    cat("Dons", "INCOME"),
    cat("Location de salle", "EXPENSE"),
    cat("Équipement", "EXPENSE"),
    cat("Déplacements compétitions", "EXPENSE"),
    cat("Arbitrage", "EXPENSE"),
  ]);

  const now = new Date();
  const monthsAgo = (n: number, day: number) => new Date(now.getFullYear(), now.getMonth() - n, day);
  const admin = await db.user.findFirst({ where: { profile: "ADMIN" } });

  const ops: Prisma.OperationCreateManyInput[] = [
    { accountId: banque.id, type: "INCOME", categoryId: subventions.id, date: monthsAgo(2, 5), amount: 800_000, counterparty: "Mairie", description: "Subvention annuelle", status: "APPROVED", approvedById: admin?.id, approvedAt: monthsAgo(2, 5), recordedById: admin?.id },
    { accountId: caisse.id, type: "INCOME", categoryId: dons.id, date: monthsAgo(1, 12), amount: 150_000, counterparty: "Parent d'élève", description: "Don", status: "APPROVED", approvedById: admin?.id, approvedAt: monthsAgo(1, 12), recordedById: admin?.id },
    { accountId: banque.id, type: "EXPENSE", categoryId: location.id, date: monthsAgo(2, 3), amount: 250_000, counterparty: "Gymnase municipal", description: "Location de salle — trimestre", status: "APPROVED", approvedById: admin?.id, approvedAt: monthsAgo(2, 3), recordedById: admin?.id },
    { accountId: caisse.id, type: "EXPENSE", categoryId: equipement.id, date: monthsAgo(1, 20), amount: 180_000, counterparty: "Sport Import", description: "Ceintures et protections", status: "APPROVED", approvedById: admin?.id, approvedAt: monthsAgo(1, 20), recordedById: admin?.id },
    // Dépense au-dessus du seuil de validation, encore en attente (illustre US-6.3)
    { accountId: banque.id, type: "EXPENSE", categoryId: deplacements.id, date: monthsAgo(0, 2), amount: 350_000, counterparty: "Transport Malagasy", description: "Déplacement championnat régional", status: "PENDING", recordedById: admin?.id },
    { accountId: caisse.id, type: "EXPENSE", categoryId: arbitrage.id, date: monthsAgo(0, 8), amount: 60_000, counterparty: "Fédération", description: "Frais d'arbitrage", status: "APPROVED", approvedById: admin?.id, approvedAt: monthsAgo(0, 8), recordedById: admin?.id },
    { accountId: caisse.id, transferAccountId: mvola.id, type: "TRANSFER", date: monthsAgo(0, 15), amount: 100_000, description: "Dépôt caisse vers Mobile Money", status: "APPROVED", approvedById: admin?.id, approvedAt: monthsAgo(0, 15), recordedById: admin?.id },
  ];
  await db.operation.createMany({ data: ops });

  // Budget prévisionnel de l'année scolaire en cours.
  // SQLite ne supporte pas `skipDuplicates` sur createMany : upsert un par un (idempotent).
  const association = await db.association.findFirstOrThrow();
  const budgetLines: [string, number][] = [
    [subventions.id, 1_000_000],
    [location.id, 1_000_000],
    [equipement.id, 500_000],
    [deplacements.id, 900_000],
    [arbitrage.id, 200_000],
  ];
  for (const [categoryId, amount] of budgetLines) {
    await db.budget.upsert({
      where: { schoolYear_categoryId: { schoolYear: association.currentSchoolYear, categoryId } },
      create: { schoolYear: association.currentSchoolYear, categoryId, amount },
      update: {},
    });
  }
}
