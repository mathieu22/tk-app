// Une compétition passée avec résultats et quelques pesées, pour exercer l'EPIC 5 en démo.
import type { PrismaClient } from "../../src/generated/prisma/client";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function seed(db: PrismaClient) {
  if (process.env.SEED_DEMO !== "1") return;

  if ((await db.competition.count()) > 0) return;

  const [members, eventType] = await Promise.all([
    db.member.findMany({ where: { matricule: { in: ["ATH-0001", "ATH-0003", "ATH-0005"] } } }),
    db.eventType.findFirst({ where: { label: "Compétition" } }),
  ]);
  const byMatricule = new Map(members.map((m) => [m.matricule, m]));
  const hery = byMatricule.get("ATH-0001"); // adulte
  const tojo = byMatricule.get("ATH-0003"); // enfant, kyorugi
  const fanja = byMatricule.get("ATH-0005"); // ados, poomsae
  if (!hery || !tojo || !fanja) return;

  const date = daysAgo(60);
  const event = eventType
    ? await db.event.create({
        data: {
          title: "Championnat régional 2026", typeId: eventType.id, startDate: date, endDate: date,
          location: "Antananarivo", audience: "SELECTION", participationMode: "SUMMONS",
          days: { create: { date } },
        },
      })
    : null;

  const competition = await db.competition.create({
    data: { name: "Championnat régional 2026", startDate: date, endDate: date, location: "Antananarivo", level: "REGIONAL", eventId: event?.id },
  });

  await db.result.createMany({
    data: [
      { competitionId: competition.id, memberId: hery.id, discipline: "KYORUGI", sex: "M", ageCategory: "Seniors", weightCategory: "-68 kg", weighInKg: 67.4, outcome: "SILVER" },
      { competitionId: competition.id, memberId: tojo.id, discipline: "KYORUGI", sex: "M", ageCategory: "Benjamins", weightCategory: "-33 kg", weighInKg: 31.8, outcome: "GOLD" },
      { competitionId: competition.id, memberId: fanja.id, discipline: "POOMSAE_IND", sex: "F", ageCategory: "Juniors", score: "7.2", outcome: "RANK", rank: 5 },
    ],
  });

  await db.weighIn.createMany({
    data: [
      { memberId: tojo.id, date: daysAgo(90), weightKg: 31.2 },
      { memberId: tojo.id, date: daysAgo(65), weightKg: 31.8 },
      { memberId: tojo.id, date: daysAgo(10), weightKg: 32.4 },
      { memberId: fanja.id, date: daysAgo(80), weightKg: 47.5 },
      { memberId: fanja.id, date: daysAgo(20), weightKg: 47.9 },
    ],
  });
}
