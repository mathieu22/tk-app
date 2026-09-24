// Frais d'événements (US-1.7 → module Cotisations, type EVENT).
import "server-only";
import { db } from "@/lib/db";
import { ensureEventDues } from "@/lib/fees";
import { stats } from "../data";

/** Événements payants non annulés, avec leurs échéances à jour et leurs chiffres. */
export async function eventsWithFees() {
  const events = await db.event.findMany({
    where: { fee: { gt: 0 }, cancelled: false },
    orderBy: { startDate: "asc" },
    include: { type: { select: { label: true, color: true } } },
  });
  for (const e of events) await ensureEventDues(e.id);
  const dues = await db.due.findMany({
    where: { eventId: { in: events.map((e) => e.id) }, member: { archived: false } },
    select: { eventId: true, status: true, amountDue: true, amountPaid: true },
  });
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return events.map((e) => ({
    ...e,
    upcoming: e.endDate >= now,
    s: stats(dues.filter((d) => d.eventId === e.id)),
  }));
}
