// Événements de démonstration (US-1.6 → 1.10) : un stage passé avec présences,
// une compétition à venir avec frais, une réunion des parents.
import type { PrismaClient } from "../../src/generated/prisma/client";

function daysBetween(start: Date, end: Date) {
  const out: Date[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(new Date(d));
  return out;
}

export async function seed(db: PrismaClient) {
  if (process.env.SEED_DEMO !== "1") return;

  if (await db.event.findFirst()) return; // déjà seedé

  const [stageType, compType, meetingType] = await Promise.all([
    db.eventType.findUniqueOrThrow({ where: { label: "Stage" } }),
    db.eventType.findUniqueOrThrow({ where: { label: "Compétition" } }),
    db.eventType.findUniqueOrThrow({ where: { label: "Réunion" } }),
  ]);
  const members = await db.member.findMany({ where: { status: "ACTIVE" } });
  if (members.length === 0) return;

  // 1. Stage technique — passé, 2 jours, convocation, présences enregistrées
  const stageStart = new Date();
  stageStart.setDate(stageStart.getDate() - 20);
  stageStart.setHours(0, 0, 0, 0);
  const stageEnd = new Date(stageStart);
  stageEnd.setDate(stageStart.getDate() + 1);
  const stage = await db.event.create({
    data: {
      title: "Stage technique de rentrée", typeId: stageType.id, startDate: stageStart, endDate: stageEnd,
      location: "Gymnase d'Ankorondrano", description: "Travail des poomsae et du kibon sur deux jours.",
      audience: "ALL", participationMode: "SUMMONS",
    },
  });
  const stageDays = await Promise.all(
    daysBetween(stageStart, stageEnd).map((date) => db.eventDay.create({ data: { eventId: stage.id, date, startTime: "09:00", endTime: "16:00" } })),
  );
  await db.eventRegistration.createMany({
    data: members.map((m, i) => ({ eventId: stage.id, memberId: m.id, response: i % 5 === 0 ? "NO" : "YES", respondedAt: stageStart })),
  });
  for (const day of stageDays) {
    const present = members.filter((_, i) => i % 5 !== 0 && i % 4 !== 1); // quelques absents pour l'exemple
    await db.attendance.createMany({
      data: present.map((m) => ({ eventDayId: day.id, memberId: m.id, status: "PRESENT", scannedAt: new Date(day.date.getTime() + 9 * 3600e3), mode: "QR" })),
    });
  }

  // 2. Championnat régional — à venir, frais d'engagement, inscriptions en cours
  const compStart = new Date();
  compStart.setDate(compStart.getDate() + 25);
  compStart.setHours(0, 0, 0, 0);
  const regUntil = new Date();
  regUntil.setDate(regUntil.getDate() + 10);
  const competition = await db.event.create({
    data: {
      title: "Championnat régional", typeId: compType.id, startDate: compStart, endDate: compStart,
      location: "Palais des sports, Antananarivo", description: "Engagements kyorugi et poomsae.",
      audience: "ALL", participationMode: "REGISTRATION", registrationUntil: regUntil, fee: 20000, maxSeats: members.length,
    },
  });
  await db.eventDay.create({ data: { eventId: competition.id, date: compStart, startTime: "08:00", endTime: "18:00" } });
  const responses = ["YES", "YES", "MAYBE", "PENDING"] as const;
  await db.eventRegistration.createMany({
    data: members.map((m, i) => ({
      eventId: competition.id, memberId: m.id, response: responses[i % responses.length],
      respondedAt: responses[i % responses.length] === "PENDING" ? null : compStart,
    })),
  });
  const feeType = await db.feeType.findUniqueOrThrow({ where: { code: "EVENT" } });
  const schoolYear = `${compStart.getMonth() + 1 >= 9 ? compStart.getFullYear() : compStart.getFullYear() - 1}-${compStart.getMonth() + 1 >= 9 ? compStart.getFullYear() + 1 : compStart.getFullYear()}`;
  const confirmed = members.filter((_, i) => responses[i % responses.length] === "YES");
  await db.due.createMany({
    data: confirmed.map((m) => ({ memberId: m.id, feeTypeId: feeType.id, schoolYear, month: 0, amountDue: 20000, eventId: competition.id, eventKey: competition.id })),
  });

  // 3. Réunion des parents — à venir, ouverte, pointage par QR parent
  const meetingStart = new Date();
  meetingStart.setDate(meetingStart.getDate() + 7);
  meetingStart.setHours(0, 0, 0, 0);
  const meeting = await db.event.create({
    data: {
      title: "Réunion des parents", typeId: meetingType.id, startDate: meetingStart, endDate: meetingStart,
      location: "Salle du club", description: "Point sur la saison, cotisations et calendrier des compétitions.",
      audience: "PARENTS", participationMode: "OPEN",
    },
  });
  await db.eventDay.create({ data: { eventId: meeting.id, date: meetingStart, startTime: "18:00", endTime: "19:30" } });
}
