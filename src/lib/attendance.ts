// Calculs de présence des séances et événements (US-1.1, 1.4, 1.6, 1.10, 1.11, 2.4).
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import type { CurrentUser } from "./dal";
import { BOARD_POSITIONS } from "./domain";

/** Membres attendus à une séance : actifs, non archivés, du groupe de la séance (ou tous). */
export function expectedMembersWhere(groupId: string | null): Prisma.MemberWhereInput {
  return { status: "ACTIVE", archived: false, ...(groupId ? { groupId } : {}) };
}

/**
 * Présents / attendus / taux pour une liste de séances.
 * Le statut Excusé est retiré du total attendu (non compté comme absent, US-1.4).
 */
export async function sessionStats(sessions: { id: string; groupId: string | null }[]) {
  const ids = sessions.map((s) => s.id);
  const [counts, groupSizes, allActive] = await Promise.all([
    db.attendance.groupBy({ by: ["sessionId", "status"], where: { sessionId: { in: ids } }, _count: true }),
    db.member.groupBy({ by: ["groupId"], where: expectedMembersWhere(null), _count: true }),
    db.member.count({ where: expectedMembersWhere(null) }),
  ]);
  const sizeOf = (groupId: string | null) =>
    groupId ? (groupSizes.find((g) => g.groupId === groupId)?._count ?? 0) : allActive;

  return new Map(
    sessions.map((s) => {
      const of = (status: string) => counts.find((c) => c.sessionId === s.id && c.status === status)?._count ?? 0;
      const present = of("PRESENT");
      const excused = of("EXCUSED");
      // Garde-fou : des présents hors groupe (ajoutés sur confirmation) peuvent dépasser l'effectif.
      const total = Math.max(sizeOf(s.groupId) - excused, present);
      const pct = total ? Math.round((present / total) * 100) : 0;
      return [s.id, { present, excused, total, pct }];
    }),
  );
}

// ─── Événements ───

type EventLike = {
  id: string;
  audience: string;
  participationMode: string;
  audienceGroupIds: string;
  startDate: Date;
};

export const groupIdsOf = (e: { audienceGroupIds: string }): string[] => {
  try {
    const v = JSON.parse(e.audienceGroupIds || "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

/** Membres visés par le public d'un événement (hors SELECTION et PARENTS, gérés par inscriptions / parents). */
export function audienceWhere(e: { audience: string; audienceGroupIds: string }): Prisma.MemberWhereInput | null {
  const base = expectedMembersWhere(null);
  switch (e.audience) {
    case "ALL":
      return base;
    case "GROUPS":
      return { ...base, groupId: { in: groupIdsOf(e) } };
    case "BOARD":
      return { ...base, position: { in: BOARD_POSITIONS } };
    default:
      return null;
  }
}

/** Parents concernés par une réunion des parents : tuteurs des membres actifs. */
export function audienceParentsWhere(): Prisma.ParentWhereInput {
  return { children: { some: { member: expectedMembersWhere(null) } } };
}

/** Inscription « confirmée » (compte dans les inscrits / places) : Participe, ou convoqué non excusé. */
export function isConfirmed(e: { participationMode: string }, r: { response: string; waitlistRank: number | null }) {
  if (r.waitlistRank !== null) return false;
  return e.participationMode === "SUMMONS" ? r.response !== "NO" : r.response === "YES";
}

/** Statistiques par événement : inscrits (Y), présents (au moins un jour), absents, attente, liste d'attente. */
export async function eventStats(events: EventLike[]) {
  const ids = events.map((e) => e.id);
  const [regs, att, parentAtt, dues] = await Promise.all([
    db.eventRegistration.findMany({ where: { eventId: { in: ids } }, select: { eventId: true, memberId: true, response: true, waitlistRank: true } }),
    db.attendance.findMany({ where: { eventDay: { eventId: { in: ids } }, status: "PRESENT" }, select: { memberId: true, eventDay: { select: { eventId: true } } } }),
    db.parentAttendance.findMany({ where: { eventDay: { eventId: { in: ids } } }, select: { parentId: true, eventDay: { select: { eventId: true } } } }),
    db.due.groupBy({ by: ["eventKey"], where: { eventKey: { in: ids } }, _sum: { amountDue: true, amountPaid: true } }),
  ]);
  const openCounts = new Map<string, number>();
  let parentCount: number | null = null;
  for (const e of events) {
    if (e.audience === "PARENTS") {
      parentCount ??= await db.parent.count({ where: audienceParentsWhere() });
      openCounts.set(e.id, parentCount);
    } else if (e.participationMode === "OPEN") {
      const where = audienceWhere(e);
      if (where) openCounts.set(e.id, await db.member.count({ where }));
    }
  }
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return new Map(
    events.map((e) => {
      const r = regs.filter((x) => x.eventId === e.id);
      const confirmed = new Set(r.filter((x) => isConfirmed(e, x)).map((x) => x.memberId));
      const presentIds =
        e.audience === "PARENTS"
          ? new Set(parentAtt.filter((a) => a.eventDay.eventId === e.id).map((a) => a.parentId))
          : new Set(att.filter((a) => a.eventDay?.eventId === e.id).map((a) => a.memberId));
      const registered = openCounts.get(e.id) ?? confirmed.size;
      const present = presentIds.size;
      const started = e.startDate <= today;
      const absent = started ? Math.max(0, registered - present) : 0;
      const total = Math.max(registered, present);
      const d = dues.find((x) => x.eventKey === e.id);
      return [e.id, {
        registered, present, absent, started,
        pct: total ? Math.round((present / total) * 100) : 0,
        pending: r.filter((x) => x.response === "PENDING" && x.waitlistRank === null).length,
        waitlist: r.filter((x) => x.waitlistRank !== null).length,
        feesDue: d?._sum.amountDue ?? 0,
        feesPaid: d?._sum.amountPaid ?? 0,
      }];
    }),
  );
}

/** Un athlète / parent peut-il voir cet événement (calendrier, .ics, US-1.12) ? */
export async function canSeeEvent(user: CurrentUser, eventId: string) {
  if (user.perms.includes("attendance.viewAll")) return true;
  const e = await db.event.findUnique({ where: { id: eventId }, include: { registrations: { select: { memberId: true } } } });
  if (!e || e.cancelled) return false;
  if (e.audience === "PARENTS") return user.profile === "PARENT";
  const memberIds =
    user.profile === "PARENT" && user.parentId
      ? (await db.parentLink.findMany({ where: { parentId: user.parentId }, select: { memberId: true } })).map((l) => l.memberId)
      : user.memberId ? [user.memberId] : [];
  if (e.registrations.some((r) => memberIds.includes(r.memberId))) return true;
  const where = audienceWhere(e);
  return !!where && (await db.member.count({ where: { AND: [where, { id: { in: memberIds } }] } })) > 0;
}

// ─── Historique d'un membre (US-1.11, US-2.4) ───

export type AttendanceStatus = "PRESENT" | "ABSENT" | "EXCUSED";

/**
 * Historique d'un membre sur une année scolaire, séances et événements séparés
 * (le taux d'entraînement n'est pas faussé par les événements). Seules les dates passées comptent.
 */
export async function memberAttendance(memberId: string, schoolYear: string, startMonth = 9) {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { groupId: true, joinedAt: true } });
  const y = Number(schoolYear.slice(0, 4));
  const from = new Date(y, startMonth - 1, 1);
  const to = new Date(y + 1, startMonth - 1, 1);
  const now = new Date();
  const until = now < to ? now : to;

  const [sessions, regs, eventAtt] = await Promise.all([
    db.session.findMany({
      where: {
        date: { gte: from, lte: until },
        OR: [{ groupId: null }, ...(member.groupId ? [{ groupId: member.groupId }] : []), { attendances: { some: { memberId } } }],
      },
      orderBy: { date: "desc" },
      include: { attendances: { where: { memberId } } },
    }),
    db.eventRegistration.findMany({
      where: { memberId, event: { startDate: { gte: from, lte: until }, cancelled: false } },
      include: { event: { include: { type: true } } },
    }),
    db.attendance.findMany({
      where: { memberId, eventDay: { date: { gte: from, lte: until } } },
      include: { eventDay: { include: { event: { include: { type: true } } } } },
    }),
  ]);

  const sessionRows = sessions
    // Pas d'absence avant l'inscription du membre
    .filter((s) => s.attendances.length > 0 || s.date >= new Date(member.joinedAt.toDateString()))
    .map((s) => ({
      id: s.id, title: s.title, date: s.date,
      status: (s.attendances[0]?.status ?? "ABSENT") as AttendanceStatus,
      scannedAt: s.attendances[0]?.scannedAt ?? null,
    }));

  const events = new Map<string, { id: string; title: string; date: Date; type: string; color: string; status: AttendanceStatus }>();
  for (const r of regs) {
    if (!isConfirmed(r.event, r)) continue;
    events.set(r.eventId, { id: r.eventId, title: r.event.title, date: r.event.startDate, type: r.event.type.label, color: r.event.type.color, status: "ABSENT" });
  }
  for (const a of eventAtt) {
    if (!a.eventDay) continue;
    const e = a.eventDay.event;
    const cur = events.get(e.id);
    if (a.status === "PRESENT" || !cur) {
      events.set(e.id, { id: e.id, title: e.title, date: e.startDate, type: e.type.label, color: e.type.color, status: a.status as AttendanceStatus });
    }
  }
  const eventRows = [...events.values()].sort((a, b) => b.date.getTime() - a.date.getTime());

  const rate = (rows: { status: AttendanceStatus }[]) => {
    const present = rows.filter((r) => r.status === "PRESENT").length;
    const total = rows.filter((r) => r.status !== "EXCUSED").length;
    return { present, total, pct: total ? Math.round((present / total) * 100) : 0 };
  };

  // Barres par mois (septembre → août) pour les séances
  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const month = ((startMonth - 1 + i) % 12) + 1;
    const rows = sessionRows.filter((s) => s.date.getMonth() + 1 === month);
    return { month, ...rate(rows) };
  });

  return { sessions: sessionRows, events: eventRows, sessionRate: rate(sessionRows), eventRate: rate(eventRows), byMonth };
}
