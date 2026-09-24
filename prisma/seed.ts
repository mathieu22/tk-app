// Référentiels (grades annexe A, frais, types d'événements, groupes) + compte admin.
// Lancer avec `npm run db:seed`. Idempotent (upsert) : sûr à rejouer sur une base réelle.
// Les données de démonstration (membres, séances, événements, palmarès, trésorerie…) ne sont
// chargées qu'avec `npm run db:seed:demo` (SEED_DEMO=1) — jamais sur une base de production.
import "dotenv/config";
import { readdirSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { schoolYearOf } from "../src/lib/format";

// ─── Annexe A — grilles de grades du club ───
type G = [number, string, string, string | null, number, string | null, string | null];
// [keup, ceinture, couleur, barrette, nb barrettes, poomsae, règle de tirage]
const ADULTE: G[] = [
  [10, "Blanche", "white", null, 0, null, null],
  [9, "Jaune", "yellow", null, 0, "Il Jang – Yi Jang", null],
  [8, "Jaune 1 barrette bleue", "yellow", "blue", 1, "Sam Jang", null],
  [7, "Jaune 2 barrettes bleues", "yellow", "blue", 2, "Sah Jang", null],
  [6, "Bleue", "blue", null, 0, "Oh Jang", null],
  [5, "Bleue 1 barrette rouge", "blue", "red", 1, "Yuk Jang", null],
  [4, "Bleue 2 barrettes rouges", "blue", "red", 2, "Tchil Jang", null],
  [3, "Rouge", "red", null, 0, "Pal Jang", null],
  [2, "Rouge 1 barrette noire", "red", "black", 1, "Pal Jang", "2 poomsae au choix (tirage)"],
  [1, "Rouge 2 barrettes noires", "red", "black", 2, "Pal Jang", "1 poomsae (tirage) jusqu'au Koryo"],
];
const ENFANT: G[] = [
  [15, "Blanche", "white", null, 0, null, null],
  [14, "Jaune", "yellow", null, 0, "Il Jang", null],
  [13, "Jaune 1 barrette orange", "yellow", "orange", 1, "Yi Jang", null],
  [12, "Orange", "orange", null, 0, "Yi Jang", null],
  [11, "Orange 1 barrette verte", "orange", "green", 1, "Sam Jang", null],
  [10, "Verte", "green", null, 0, "Sam Jang", null],
  [9, "Verte 1 barrette violette", "green", "purple", 1, "Sah Jang", null],
  [8, "Violette", "purple", null, 0, "Sah Jang", null],
  [7, "Violette 1 barrette bleue", "purple", "blue", 1, "Oh Jang", null],
  ...ADULTE.slice(4), // du 6e au 1er keup, grilles identiques
];

async function seedGrid(name: string, ageMin: number | null, ageMax: number | null, rows: G[]) {
  const grid = await db.gradeGrid.upsert({ where: { name }, update: {}, create: { name, ageMin, ageMax } });
  for (const [i, [number, beltLabel, mainColor, stripeColor, stripeCount, poomsae, drawRule]] of rows.entries()) {
    const data = { beltLabel, mainColor, stripeColor, stripeCount, poomsae, drawRule, order: i };
    await db.grade.upsert({
      where: { gridId_kind_number: { gridId: grid.id, kind: "KEUP", number } },
      update: data,
      create: { ...data, gridId: grid.id, kind: "KEUP", number },
    });
  }
}

async function main() {
  const schoolYear = schoolYearOf(new Date());

  if (!(await db.association.findFirst())) {
    await db.association.create({ data: { name: "Gestion TKDChoc", currentSchoolYear: schoolYear } });
  }

  await seedGrid("Enfant", null, 15, ENFANT);
  await seedGrid("Adulte", 16, null, ADULTE);

  // Types de frais (spec EPIC 3). Montants provisoires — question ouverte n°8, à ajuster
  // dans Réglages → Montants.
  const fees = [
    { code: "DROIT", label: "Droit", periodicity: "YEARLY", color: "#1565C0", amount: 50000 },
    { code: "PASSPORT", label: "Passport", periodicity: "YEARLY", color: "#6A1B9A", amount: 30000 },
    { code: "ECOLAGE", label: "Écolage", periodicity: "MONTHLY", color: "#00695C", amount: 25000 },
  ];
  for (const { amount, ...f } of fees) {
    const ft = await db.feeType.upsert({ where: { code: f.code }, update: {}, create: f });
    const existing = await db.tariff.findFirst({ where: { feeTypeId: ft.id, schoolYear, groupId: null } });
    if (!existing) await db.tariff.create({ data: { feeTypeId: ft.id, schoolYear, amount } });
  }

  const eventTypes = [
    { label: "Stage", icon: "dumbbell", color: "#0ea5e9" },
    { label: "Passage de grade", icon: "award", color: "#f59e0b" },
    { label: "Compétition", icon: "trophy", color: "#dc2626" },
    { label: "Démonstration", icon: "sparkles", color: "#8b5cf6" },
    { label: "Réunion", icon: "users", color: "#64748b" },
    { label: "Sortie / vie du club", icon: "party-popper", color: "#16a34a" },
  ];
  for (const t of eventTypes) await db.eventType.upsert({ where: { label: t.label }, update: {}, create: t });

  for (const name of ["Enfants", "Ados", "Adultes"]) {
    await db.group.upsert({ where: { name }, update: {}, create: { name } });
  }

  // Compte administrateur (toujours créé, y compris en production : c'est le premier accès à l'application)
  const adminPhone = "+261340000000";
  if (!(await db.user.findUnique({ where: { phone: adminPhone } }))) {
    await db.user.create({
      data: { phone: adminPhone, passwordHash: await bcrypt.hash("admin1234", 10), profile: "ADMIN" },
    });
  }

  // Référentiels et démo des modules : prisma/seeds/NN-*.ts exportant `seed(db)`, dans l'ordre.
  // Les fichiers de démonstration se protègent eux-mêmes avec `if (process.env.SEED_DEMO !== "1") return;`.
  const dir = path.join(import.meta.dirname, "seeds");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts")).sort()) {
    const mod = (await import(path.join(dir, file))) as { seed: (d: typeof db) => Promise<void> };
    await mod.seed(db);
    console.log(`  ✓ ${file}`);
  }

  console.log(
    process.env.SEED_DEMO === "1"
      ? "Seed terminé (avec démo). Admin : +261 34 00 000 00 / admin1234"
      : "Seed terminé (référentiels uniquement). Admin : +261 34 00 000 00 / admin1234",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
