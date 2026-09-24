// Tuteurs et comptes de démonstration (US-2.5 règles TUTEUR1/2, US-7.1, US-2.5 majorité) :
// un même parent associé à deux enfants (compte unique), un compte athlète, quelques pesées.
import bcrypt from "bcryptjs";
import type { PrismaClient } from "../../src/generated/prisma/client";

const unusablePassword = (plain: string) => bcrypt.hash(plain, 10);

export async function seed(db: PrismaClient) {
  if (process.env.SEED_DEMO !== "1") return;

  const [tojo, mialy, fanja] = await Promise.all([
    db.member.findUnique({ where: { matricule: "ATH-0003" } }), // Tojo Andriamanana, mineur
    db.member.findUnique({ where: { matricule: "ATH-0004" } }), // Mialy Raharisoa, mineure
    db.member.findUnique({ where: { matricule: "ATH-0005" }, include: { user: true } }), // Fanja Randrianarisoa
  ]);

  // Un tuteur unique pour deux enfants du club (US-2.5 : un même parent n'a qu'un seul compte).
  if (tojo || mialy) {
    const parentPhone = "+261340000011";
    const parent = await db.parent.upsert({
      where: { phone: parentPhone },
      update: {},
      create: { firstName: "Nirina", lastName: "RAKOTO", phone: parentPhone, email: "nirina.rakoto@exemple.mg" },
    });
    if (!parent.userId) {
      const user = await db.user.upsert({
        where: { phone: parentPhone },
        update: {},
        create: { phone: parentPhone, passwordHash: await unusablePassword("parent1234"), profile: "PARENT", lastLoginAt: new Date() },
      });
      await db.parent.update({ where: { id: parent.id }, data: { userId: user.id } });
    }
    for (const child of [tojo, mialy]) {
      if (!child) continue;
      await db.parentLink.upsert({
        where: { parentId_memberId: { parentId: parent.id, memberId: child.id } },
        update: { relationship: "MOTHER", rank: 1 },
        create: { parentId: parent.id, memberId: child.id, relationship: "MOTHER", rank: 1 },
      });
    }
  }

  // Compte athlète de démonstration (accès « Mon espace », US-7.2 / EPIC 9).
  if (fanja && !fanja.user) {
    const athletePhone = "+261340000012";
    await db.user.upsert({
      where: { phone: athletePhone },
      update: {},
      create: { phone: athletePhone, passwordHash: await unusablePassword("athlete1234"), profile: "ATHLETE", memberId: fanja.id, lastLoginAt: new Date() },
    });
  }

  // Quelques pesées (US-2.5, US-5.5 : catégorie de poids proposée à partir de la dernière pesée).
  if ((await db.weighIn.count()) === 0) {
    const weighIns: { matricule: string; weightKg: number; monthsAgo: number }[] = [
      { matricule: "ATH-0003", weightKg: 43.5, monthsAgo: 1 },
      { matricule: "ATH-0004", weightKg: 34.0, monthsAgo: 2 },
      { matricule: "ATH-0005", weightKg: 51.2, monthsAgo: 1 },
      { matricule: "ATH-0006", weightKg: 68.0, monthsAgo: 3 },
    ];
    for (const w of weighIns) {
      const m = await db.member.findUnique({ where: { matricule: w.matricule } });
      if (!m) continue;
      const date = new Date();
      date.setMonth(date.getMonth() - w.monthsAgo);
      await db.weighIn.create({ data: { memberId: m.id, weightKg: w.weightKg, date } });
    }
  }
}
