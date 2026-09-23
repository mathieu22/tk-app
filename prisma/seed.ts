// Données de référence (annexe A, types de frais, types d'événements) + jeu de démo.
// Lancer avec `npm run db:seed`. Idempotent (upsert) pour les référentiels.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { schoolYearOf } from "../src/lib/format";
import { newQrToken } from "../src/lib/qr";

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
    await db.association.create({ data: { name: "Club de Taekwondo", currentSchoolYear: schoolYear } });
  }

  await seedGrid("Enfant", null, 15, ENFANT);
  await seedGrid("Adulte", 16, null, ADULTE);

  // Types de frais (spec EPIC 3). Montants du design, provisoires — question ouverte n°8.
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

  // Compte administrateur de développement
  const adminPhone = "+261340000000";
  if (!(await db.user.findUnique({ where: { phone: adminPhone } }))) {
    await db.user.create({
      data: { phone: adminPhone, passwordHash: await bcrypt.hash("admin1234", 10), profile: "ADMIN" },
    });
  }

  // Membres de démo
  if ((await db.member.count()) === 0) {
    const groups = await db.group.findMany();
    const demo = [
      ["RAKOTOMALALA", "Hery", "M", "1985-04-12", "PRESIDENT", "Adultes"],
      ["RASOANIRINA", "Voahangy", "F", "1990-09-03", "TREASURER", "Adultes"],
      ["ANDRIAMANANA", "Tojo", "M", "2012-02-20", "ATHLETE", "Enfants"],
      ["RAHARISOA", "Mialy", "F", "2014-06-15", "ATHLETE", "Enfants"],
      ["RANDRIANARISOA", "Fanja", "F", "2009-11-30", "ATHLETE", "Ados"],
      ["RAZAFINDRAKOTO", "Njaka", "M", "2000-01-08", "COACH", "Adultes"],
    ] as const;
    for (const [i, [lastName, firstName, sex, birth, position, group]] of demo.entries()) {
      await db.member.create({
        data: {
          matricule: `ATH-${String(i + 1).padStart(4, "0")}`,
          lastName, firstName, sex, position,
          birthDate: new Date(birth),
          phone: `+26134${String(1000000 + i * 1111).slice(0, 7)}`,
          groupId: groups.find((g) => g.name === group)?.id,
          qrToken: newQrToken(),
        },
      });
    }
  }

  // Séances de démo (4 dernières semaines) avec présences
  if ((await db.session.count()) === 0) {
    const members = await db.member.findMany({ where: { status: "ACTIVE" } });
    const titles = ["Entraînement technique", "Entraînement poomsae", "Kyorugi — combat", "Entraînement technique"];
    for (const [i, title] of titles.entries()) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (titles.length - i) * 4);
      const session = await db.session.create({ data: { title, date, startTime: "17:30", endTime: "19:00", location: "Gymnase" } });
      // Présence déterministe : chaque membre manque environ une séance sur trois
      const present = members.filter((_, j) => (i + j) % 3 !== 0);
      await db.attendance.createMany({
        data: present.map((m) => ({ sessionId: session.id, memberId: m.id, scannedAt: new Date(date.getTime() + 17.5 * 3600e3), mode: "QR" })),
      });
    }
  }

  console.log("Seed terminé. Admin : +261 34 00 000 00 / admin1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
