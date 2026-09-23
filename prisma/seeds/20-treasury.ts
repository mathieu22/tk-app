// Comptes de trésorerie et catégories par défaut (US-6.1, 6.3), type de frais « Événement ».
import type { PrismaClient } from "../../src/generated/prisma/client";

export async function seed(db: PrismaClient) {
  await db.feeType.upsert({
    where: { code: "EVENT" }, update: {},
    create: { code: "EVENT", label: "Événement", periodicity: "ONCE", color: "#B45309" },
  });
  if ((await db.treasuryAccount.count()) === 0) {
    await db.treasuryAccount.createMany({
      data: [
        { name: "Caisse", type: "CASH" },
        { name: "MVola", type: "MOBILE_MONEY", operator: "MVOLA" },
        { name: "Orange Money", type: "MOBILE_MONEY", operator: "ORANGE_MONEY" },
        { name: "Airtel Money", type: "MOBILE_MONEY", operator: "AIRTEL_MONEY" },
        { name: "Banque", type: "BANK" },
      ],
    });
  }
  const categories: [string, "INCOME" | "EXPENSE", boolean?][] = [
    ["Cotisations", "INCOME", true], ["Subventions", "INCOME"], ["Dons", "INCOME"], ["Sponsors", "INCOME"],
    ["Ventes d'équipement", "INCOME"], ["Événements", "INCOME"],
    ["Location de salle", "EXPENSE"], ["Équipement", "EXPENSE"], ["Déplacements compétitions", "EXPENSE"],
    ["Frais de fédération", "EXPENSE"], ["Arbitrage", "EXPENSE"], ["Communication", "EXPENSE"], ["Divers", "EXPENSE"],
  ];
  for (const [name, type, system] of categories) {
    await db.operationCategory.upsert({ where: { name_type: { name, type } }, update: {}, create: { name, type, system: !!system } });
  }
}
