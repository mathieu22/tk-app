// Membres et séances de démonstration. Ne s'exécute que si SEED_DEMO=1 (npm run db:seed:demo) :
// une base de production charge uniquement les référentiels (npm run db:seed).
import type { PrismaClient } from "../../src/generated/prisma/client";
import { newQrToken } from "../../src/lib/qr";

export async function seed(db: PrismaClient) {
  if (process.env.SEED_DEMO !== "1") return;

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
}
