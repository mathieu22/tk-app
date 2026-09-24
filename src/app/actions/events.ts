"use server";
// Événements (US-1.6 → 1.10) : création, inscriptions / liste d'attente, pointage, rappels, hors connexion.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audienceParentsWhere, audienceWhere, isConfirmed } from "@/lib/attendance";
import { isMinor } from "@/lib/categories";
import { db } from "@/lib/db";
import { requirePermission, requireStaff, requireUser, visibleMemberIds } from "@/lib/dal";
import { fullName, POSITIONS, type Position } from "@/lib/domain";
import { ensureEventDues } from "@/lib/fees";
import { formatDate } from "@/lib/format";
import { sendMessage } from "@/lib/messaging";
import { notifyMember } from "@/lib/notify";
import { parseQrPayload } from "@/lib/qr";
import { scan, type ScanResult } from "./sessions";

const revalidateEvent = (id: string) => {
  revalidatePath(`/presence/evenements/${id}`);
  revalidatePath("/presence/evenements");
  revalidatePath("/calendrier");
};

// ─── Création / modification (US-1.7) ───

export type EventFormState = { errors?: Record<string, string>; values?: Record<string, string> } | undefined;

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const time = z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]);
const eventSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Le titre est obligatoire.").max(120),
  typeId: z.string().min(1, "Choisissez un type."),
  startDate: z.string().regex(dateRe, "Date invalide."),
  endDate: z.union([z.literal(""), z.string().regex(dateRe, "Date invalide.")]),
  startTime: time,
  endTime: time,
  location: z.string().trim().max(160),
  description: z.string().trim().max(2000),
  audience: z.enum(["ALL", "GROUPS", "SELECTION", "BOARD", "PARENTS"]),
  groupIds: z.string(), // ids séparés par des virgules
  memberIds: z.string(), // sélection libre
  participationMode: z.enum(["SUMMONS", "REGISTRATION", "OPEN"]),
  maxSeats: z.union([z.literal(""), z.coerce.number().int().min(1, "Au moins 1 place.").max(10000)]),
  registrationUntil: z.union([z.literal(""), z.string().regex(dateRe, "Date invalide.")]),
  fee: z.union([z.literal(""), z.coerce.number().int().min(0).max(100_000_000)]),
});

const localDate = (d: string) => new Date(`${d}T00:00:00`);
const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function daysBetween(start: Date, end: Date) {
  const days: Date[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  return days;
}

export async function saveEvent(_: EventFormState, formData: FormData): Promise<EventFormState> {
  const user = await requirePermission("event.manage");
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = eventSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors, values };
  }
  const d = parsed.data;
  const start = localDate(d.startDate);
  const end = d.endDate ? localDate(d.endDate) : start;
  const fail = (field: string, msg: string): EventFormState => ({ errors: { [field]: msg }, values });
  if (end < start) return fail("endDate", "La date de fin doit suivre la date de début.");
  if (daysBetween(start, end).length > 31) return fail("endDate", "31 jours maximum.");
  if (d.startTime && d.endTime && start.getTime() === end.getTime() && d.endTime <= d.startTime) {
    return fail("endTime", "L'heure de fin doit suivre l'heure de début.");
  }
  if (!(await db.eventType.findUnique({ where: { id: d.typeId } }))) return fail("typeId", "Type inconnu.");
  const groupIds = csv(d.groupIds);
  if (d.audience === "GROUPS" && groupIds.length === 0) return fail("groupIds", "Choisissez au moins un groupe.");
  const memberIds = csv(d.memberIds);
  if (d.audience === "SELECTION" && memberIds.length === 0) return fail("memberIds", "Sélectionnez au moins un athlète.");
  if (d.participationMode === "REGISTRATION" && d.registrationUntil && localDate(d.registrationUntil) > end) {
    return fail("registrationUntil", "La date limite doit précéder la fin de l'événement.");
  }

  const data = {
    title: d.title,
    typeId: d.typeId,
    startDate: start,
    endDate: end,
    location: d.location || null,
    description: d.description || null,
    audience: d.audience,
    audienceGroupIds: JSON.stringify(d.audience === "GROUPS" ? groupIds : []),
    participationMode: d.audience === "PARENTS" ? "OPEN" : d.participationMode,
    maxSeats: d.maxSeats === "" ? null : d.maxSeats,
    registrationUntil: d.participationMode === "REGISTRATION" && d.registrationUntil ? new Date(`${d.registrationUntil}T23:59:59`) : null,
    fee: d.fee === "" || d.fee === 0 ? null : d.fee,
  };

  let eventId = d.id;
  if (eventId) {
    const existing = await db.event.findUnique({ where: { id: eventId }, include: { days: { include: { _count: { select: { attendances: true, parentAttendances: true } } } } } });
    if (!existing) return fail("title", "Événement introuvable.");
    // Jours hors de la nouvelle période : supprimés s'ils n'ont aucun pointage
    const keep = new Set(daysBetween(start, end).map((x) => x.getTime()));
    const blocked = existing.days.filter((day) => !keep.has(day.date.getTime()) && day._count.attendances + day._count.parentAttendances > 0);
    if (blocked.length) return fail("startDate", `Le ${formatDate(blocked[0].date)} a déjà des présences : impossible de le retirer.`);
    await db.eventDay.deleteMany({ where: { eventId, date: { notIn: [...keep].map((t) => new Date(t)) } } });
    await db.event.update({ where: { id: eventId }, data });
    await db.eventDay.updateMany({ where: { eventId }, data: { startTime: d.startTime || null, endTime: d.endTime || null } });
  } else {
    eventId = (await db.event.create({ data: { ...data, createdById: user.id } })).id;
  }
  const have = new Set((await db.eventDay.findMany({ where: { eventId }, select: { date: true } })).map((x) => x.date.getTime()));
  const newDays = daysBetween(start, end).filter((x) => !have.has(x.getTime()));
  if (newDays.length) {
    await db.eventDay.createMany({ data: newDays.map((date) => ({ eventId: eventId!, date, startTime: d.startTime || null, endTime: d.endTime || null })) });
  }

  // Convocations / invitations : une inscription « en attente » par membre visé (jamais supprimée).
  if (data.participationMode !== "OPEN") {
    const where = d.audience === "SELECTION" ? { id: { in: memberIds }, archived: false } : audienceWhere(data);
    if (where) {
      const targets = await db.member.findMany({ where, select: { id: true } });
      const existing = new Set((await db.eventRegistration.findMany({ where: { eventId }, select: { memberId: true } })).map((r) => r.memberId));
      const rows = targets.filter((m) => !existing.has(m.id)).map((m) => ({ eventId: eventId!, memberId: m.id }));
      if (rows.length) await db.eventRegistration.createMany({ data: rows });
    }
  }
  await applySeats(eventId);
  await syncEventDues(eventId);
  await db.auditLog.create({ data: { userId: user.id, action: d.id ? "event.update" : "event.create", entity: "Event", entityId: eventId, details: d.title } });
  revalidateEvent(eventId);
  redirect(`/presence/evenements/${eventId}`);
}

export async function cancelEvent(eventId: string, cancelled: boolean) {
  const user = await requirePermission("event.manage");
  await db.event.update({ where: { id: eventId }, data: { cancelled } });
  await db.auditLog.create({ data: { userId: user.id, action: cancelled ? "event.cancel" : "event.restore", entity: "Event", entityId: eventId } });
  revalidateEvent(eventId);
}

/** Suppression réservée à l'administrateur et au Président (comme les séances, US-1.5). */
export async function deleteEvent(eventId: string) {
  const user = await requireStaff();
  if (!["ADMIN", "PRESIDENT"].includes(user.profile)) return { error: "Suppression réservée à l'administrateur et au Président." };
  const paid = await db.due.count({ where: { eventKey: eventId, OR: [{ amountPaid: { gt: 0 } }, { allocations: { some: {} } }] } });
  if (paid) return { error: "Des frais ont déjà été encaissés : annulez l'événement plutôt que de le supprimer." };
  const pointed = await db.attendance.count({ where: { eventDay: { eventId } } }) + await db.parentAttendance.count({ where: { eventDay: { eventId } } });
  if (pointed) return { error: "Des présences ont déjà été pointées : annulez l'événement plutôt que de le supprimer." };
  const e = await db.event.findUniqueOrThrow({ where: { id: eventId } });
  await db.$transaction([
    db.due.deleteMany({ where: { eventKey: eventId, allocations: { none: {} } } }),
    db.eventRegistration.deleteMany({ where: { eventId } }),
    db.event.delete({ where: { id: eventId } }),
  ]);
  await db.auditLog.create({ data: { userId: user.id, action: "event.delete", entity: "Event", entityId: eventId, details: e.title } });
  revalidatePath("/presence/evenements");
  revalidatePath("/calendrier");
  redirect("/presence/evenements");
}

// ─── Places et liste d'attente ───

/**
 * Respecte le nombre de places : les confirmations au-delà passent en liste d'attente,
 * et une place libérée fait monter la première personne en attente (US-1.8).
 */
async function applySeats(eventId: string) {
  const e = await db.event.findUniqueOrThrow({ where: { id: eventId }, include: { registrations: true } });
  const regs = e.registrations;
  const wantsSeat = (r: (typeof regs)[number]) => (e.participationMode === "SUMMONS" ? r.response !== "NO" : r.response === "YES");
  if (!e.maxSeats) {
    await db.eventRegistration.updateMany({ where: { eventId, waitlistRank: { not: null } }, data: { waitlistRank: null } });
    return;
  }
  // Ceux qui ne veulent plus de place sortent de la liste d'attente
  const leaving = regs.filter((r) => r.waitlistRank !== null && !wantsSeat(r)).map((r) => r.id);
  if (leaving.length) await db.eventRegistration.updateMany({ where: { id: { in: leaving } }, data: { waitlistRank: null } });

  const seated = regs.filter((r) => r.waitlistRank === null && wantsSeat(r));
  const waiting = regs.filter((r) => r.waitlistRank !== null && wantsSeat(r)).sort((a, b) => a.waitlistRank! - b.waitlistRank!);
  let free = e.maxSeats - seated.length;
  // Promotion depuis la liste d'attente
  for (const w of waiting) {
    if (free <= 0) break;
    await db.eventRegistration.update({ where: { id: w.id }, data: { waitlistRank: null } });
    await notifyMember(w.memberId, "EVENT", "Place confirmée", `Une place s'est libérée : inscription confirmée à « ${e.title} ».`, `/mon-espace`);
    free--;
  }
  // Débordement (ex. réduction du nombre de places) : les dernières réponses passent en attente
  if (free < 0) {
    const overflow = [...seated].sort((a, b) => (b.respondedAt?.getTime() ?? 0) - (a.respondedAt?.getTime() ?? 0)).slice(0, -free);
    let rank = Math.max(0, ...regs.map((r) => r.waitlistRank ?? 0));
    for (const o of overflow.reverse()) await db.eventRegistration.update({ where: { id: o.id }, data: { waitlistRank: ++rank } });
  }
}

/** Frais : échéances des participants confirmés ; retire celles, non payées, des non-participants. */
async function syncEventDues(eventId: string) {
  const e = await db.event.findUniqueOrThrow({ where: { id: eventId }, include: { registrations: true } });
  if (e.fee) await ensureEventDues(eventId);
  const out = e.registrations.filter((r) => !e.fee || !isConfirmed(e, r)).map((r) => r.memberId);
  if (out.length) {
    await db.due.deleteMany({ where: { eventKey: eventId, memberId: { in: out }, amountPaid: 0, allocations: { none: {} } } });
  }
}

// ─── Réponses (US-1.8) ───

export type RespondResult = { ok: true; waitlistRank: number | null } | { ok: false; error: string };

/**
 * Réponse d'un parent (pour son enfant), de l'athlète lui-même ou du staff.
 * Un mineur confirmé par sa famille doit fournir l'autorisation parentale (horodatée).
 */
export async function respondToEvent(eventId: string, memberId: string, response: "YES" | "NO" | "MAYBE", consent = false): Promise<RespondResult> {
  const user = await requireUser();
  const staff = user.perms.includes("event.manage");
  if (!staff) {
    const ids = await visibleMemberIds(user);
    if (ids !== "ALL" && !ids.includes(memberId)) return { ok: false, error: "Accès refusé." };
  }
  if (!["YES", "NO", "MAYBE"].includes(response)) return { ok: false, error: "Réponse invalide." };
  const e = await db.event.findUnique({ where: { id: eventId } });
  const member = await db.member.findUnique({ where: { id: memberId } });
  if (!e || !member || member.archived) return { ok: false, error: "Événement ou membre introuvable." };
  if (e.cancelled) return { ok: false, error: "Événement annulé." };

  let reg = await db.eventRegistration.findUnique({ where: { eventId_memberId: { eventId, memberId } } });
  if (!staff) {
    if (e.participationMode === "OPEN") return { ok: false, error: "Pas d'inscription pour cet événement." };
    if (e.registrationUntil && e.registrationUntil < new Date()) return { ok: false, error: "La date limite d'inscription est dépassée." };
    if (!reg) {
      // Inscription libre : seuls les membres du public visé peuvent s'inscrire
      const where = e.participationMode === "REGISTRATION" ? audienceWhere(e) : null;
      if (!where || !(await db.member.count({ where: { AND: [where, { id: memberId }] } }))) {
        return { ok: false, error: "Ce membre n'est pas concerné par cet événement." };
      }
    }
    if (response === "YES" && isMinor(member.birthDate) && !consent) {
      return { ok: false, error: "L'autorisation parentale est requise pour un mineur." };
    }
  }
  const now = new Date();
  const data = {
    response, respondedById: user.id, respondedAt: now,
    ...(response === "YES" && consent ? { parentalConsent: now } : {}),
  };
  reg = reg
    ? await db.eventRegistration.update({ where: { id: reg.id }, data })
    : await db.eventRegistration.create({ data: { eventId, memberId, ...data } });

  // Une nouvelle confirmation sur un événement complet part en liste d'attente
  if (e.maxSeats && response === "YES" && reg.waitlistRank === null) {
    const regs = await db.eventRegistration.findMany({ where: { eventId, waitlistRank: null } });
    const seated = regs.filter((r) => r.id !== reg!.id && isConfirmed(e, r)).length;
    if (seated >= e.maxSeats) {
      const last = await db.eventRegistration.aggregate({ where: { eventId }, _max: { waitlistRank: true } });
      reg = await db.eventRegistration.update({ where: { id: reg.id }, data: { waitlistRank: (last._max.waitlistRank ?? 0) + 1 } });
    }
  }
  await applySeats(eventId);
  await syncEventDues(eventId);
  revalidateEvent(eventId);
  revalidatePath("/mon-espace");
  const fresh = await db.eventRegistration.findUniqueOrThrow({ where: { id: reg.id } });
  return { ok: true, waitlistRank: fresh.waitlistRank };
}

/** Inscription / retrait manuel par le staff (US-1.8). */
export async function addParticipant(eventId: string, memberId: string) {
  await requirePermission("event.manage");
  return respondToEvent(eventId, memberId, "YES");
}

export async function removeParticipant(eventId: string, memberId: string) {
  const user = await requirePermission("event.manage");
  const att = await db.attendance.count({ where: { memberId, eventDay: { eventId } } });
  if (att) return { error: "Ce participant a déjà été pointé : marquez-le « Ne participe pas »." };
  await db.due.deleteMany({ where: { eventKey: eventId, memberId, amountPaid: 0, allocations: { none: {} } } });
  await db.eventRegistration.deleteMany({ where: { eventId, memberId } });
  await db.auditLog.create({ data: { userId: user.id, action: "event.removeParticipant", entity: "Event", entityId: eventId, details: memberId } });
  await applySeats(eventId);
  revalidateEvent(eventId);
  return {};
}

/** Rappel aux personnes n'ayant pas répondu (US-1.8 C) : SMS au tuteur principal, sinon à l'athlète. */
export async function remindNonResponders(eventId: string) {
  await requirePermission("event.manage");
  const e = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { registrations: { where: { response: "PENDING" }, include: { member: { include: { parents: { include: { parent: true }, orderBy: { rank: "asc" } } } } } } },
  });
  let sent = 0;
  for (const r of e.registrations) {
    const to = r.member.parents[0]?.parent.phone ?? r.member.phone;
    if (!to) continue;
    const deadline = e.registrationUntil ? ` avant le ${formatDate(e.registrationUntil)}` : "";
    await sendMessage("SMS", to, `Club : merci de confirmer la participation de ${fullName(r.member)} à « ${e.title} » (${formatDate(e.startDate)})${deadline}.`);
    sent++;
  }
  return { sent, missing: e.registrations.length - sent };
}

// ─── Pointage (US-1.9) ───

const PARENT_PREFIX = "GPH1P:";
const hhmm = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Heure de scan d'origine (mode hors connexion) : bornée entre J-7 et maintenant. */
function scanTime(at?: string) {
  const now = new Date();
  if (!at) return now;
  const t = new Date(at);
  if (Number.isNaN(t.getTime()) || t > now || now.getTime() - t.getTime() > 7 * 86400e3) return now;
  return t;
}

export type ScanInput = { qr?: string; memberId?: string; force?: boolean; at?: string; departure?: boolean };

export async function scanEvent(eventDayId: string, input: ScanInput): Promise<ScanResult> {
  const user = await requirePermission("session.manage");
  const day = await db.eventDay.findUnique({ where: { id: eventDayId }, include: { event: true } });
  if (!day) return { kind: "invalid", message: "Journée introuvable." };
  const e = day.event;
  if (e.cancelled) return { kind: "closed", message: "Événement annulé : pointage impossible." };
  const at = scanTime(input.at);

  // QR parent : réunion des parents
  if (input.qr?.trim().startsWith(PARENT_PREFIX)) {
    const token = input.qr.trim().slice(PARENT_PREFIX.length);
    const parent = /^[A-Za-z0-9_-]{16,64}$/.test(token) ? await db.parent.findUnique({ where: { qrToken: token } }) : null;
    if (!parent) return { kind: "invalid", message: "QR code parent inconnu." };
    if (e.audience !== "PARENTS") return { kind: "invalid", message: "QR parent : cet événement n'est pas une réunion des parents." };
    const name = `${parent.firstName} ${parent.lastName}`;
    const existing = await db.parentAttendance.findUnique({ where: { eventDayId_parentId: { eventDayId, parentId: parent.id } } });
    if (!existing) await db.parentAttendance.create({ data: { eventDayId, parentId: parent.id, scannedAt: at, recordedBy: user.id } });
    const present = await db.parentAttendance.count({ where: { eventDayId } });
    revalidateEvent(e.id);
    return { kind: existing ? "already" : "ok", name, role: "Parent", at: hhmm(existing?.scannedAt ?? at), photoUrl: null, present };
  }

  let member;
  if (input.qr !== undefined) {
    const token = parseQrPayload(input.qr);
    member = token ? await db.member.findUnique({ where: { qrToken: token } }) : null;
  } else if (input.memberId) {
    member = await db.member.findUnique({ where: { id: input.memberId } });
  }
  if (!member || member.archived) return { kind: "invalid", message: "QR code inconnu ou invalide." };
  if (e.audience === "PARENTS") return { kind: "invalid", message: "Réunion des parents : scannez le QR code du parent." };
  const name = fullName(member);
  const role = POSITIONS[member.position as Position] ?? member.position;
  const present = () => db.attendance.count({ where: { eventDayId, status: "PRESENT" } });

  // Départ (pointage arrivée / départ, US-1.9 C)
  if (input.departure) {
    const a = await db.attendance.findUnique({ where: { eventDayId_memberId: { eventDayId, memberId: member.id } } });
    if (!a || a.status !== "PRESENT") return { kind: "invalid", message: `${name} : arrivée non pointée.` };
    if (a.leftAt) return { kind: "already", name, role, at: hhmm(a.leftAt), photoUrl: member.photoUrl, present: await present(), title: `Départ déjà enregistré à ${hhmm(a.leftAt)}` };
    await db.attendance.update({ where: { id: a.id }, data: { leftAt: at } });
    revalidateEvent(e.id);
    return { kind: "ok", name, role, at: hhmm(at), photoUrl: member.photoUrl, present: await present(), title: "Départ enregistré" };
  }

  // Participant ? (inscrit / convoqué, ou public visé pour un événement ouvert)
  const reg = await db.eventRegistration.findUnique({ where: { eventId_memberId: { eventId: e.id, memberId: member.id } } });
  let participant = !!reg && isConfirmed(e, reg);
  if (!participant && e.participationMode === "OPEN") {
    const where = audienceWhere(e);
    participant = !!where && (await db.member.count({ where: { AND: [where, { id: member.id }] } })) > 0;
  }
  if (!participant && !input.force) {
    return { kind: "outOfGroup", name, role, memberId: member.id, reason: "Non inscrit à l'événement" };
  }
  if (!participant && e.participationMode !== "OPEN") {
    // Ajout sur place après confirmation : inscription « Participe », hors limite de places
    await db.eventRegistration.upsert({
      where: { eventId_memberId: { eventId: e.id, memberId: member.id } },
      create: { eventId: e.id, memberId: member.id, response: "YES", respondedById: user.id, respondedAt: at },
      update: { response: "YES", waitlistRank: null, respondedById: user.id, respondedAt: at },
    });
    await syncEventDues(e.id);
  }

  const existing = await db.attendance.findUnique({ where: { eventDayId_memberId: { eventDayId, memberId: member.id } } });
  if (existing?.status === "PRESENT") {
    return { kind: "already", name, role, at: hhmm(existing.scannedAt ?? at), photoUrl: member.photoUrl, present: await present() };
  }
  const mode = input.qr !== undefined ? "QR" : "MANUAL";
  await db.attendance.upsert({
    where: { eventDayId_memberId: { eventDayId, memberId: member.id } },
    create: { eventDayId, memberId: member.id, status: "PRESENT", scannedAt: at, mode, recordedBy: user.id },
    update: { status: "PRESENT", scannedAt: at, mode, recordedBy: user.id },
  });
  revalidateEvent(e.id);
  return { kind: "ok", name, role, at: hhmm(at), photoUrl: member.photoUrl, present: await present() };
}

/** Recherche pour la saisie manuelle du scanner d'événement (membres, ou parents pour une réunion). */
export async function searchEventPeople(eventDayId: string, q: string) {
  await requirePermission("session.manage");
  const t = q.trim();
  if (t.length < 2) return [];
  const day = await db.eventDay.findUnique({ where: { id: eventDayId }, include: { event: true } });
  if (!day) return [];
  if (day.event.audience === "PARENTS") {
    const parents = await db.parent.findMany({
      where: { AND: [audienceParentsWhere(), { OR: [{ lastName: { contains: t.toUpperCase() } }, { firstName: { contains: t } }] }] },
      take: 8, orderBy: { lastName: "asc" },
    });
    return parents.map((p) => ({ id: `parent:${p.id}`, name: `${p.firstName} ${p.lastName}`, role: "Parent" }));
  }
  const members = await db.member.findMany({
    where: { archived: false, OR: [{ lastName: { contains: t.toUpperCase() } }, { firstName: { contains: t } }] },
    take: 8, orderBy: { lastName: "asc" },
  });
  return members.map((m) => ({ id: m.id, name: fullName(m), role: POSITIONS[m.position as Position] ?? m.position }));
}

/** Pointage manuel d'un parent (réunion des parents, sans QR). */
export async function markParentPresent(eventDayId: string, parentId: string, at?: string): Promise<ScanResult> {
  const user = await requirePermission("session.manage");
  const day = await db.eventDay.findUnique({ where: { id: eventDayId }, include: { event: true } });
  const parent = await db.parent.findUnique({ where: { id: parentId } });
  if (!day || !parent || day.event.audience !== "PARENTS") return { kind: "invalid", message: "Pointage impossible." };
  const t = scanTime(at);
  const existing = await db.parentAttendance.findUnique({ where: { eventDayId_parentId: { eventDayId, parentId } } });
  if (!existing) await db.parentAttendance.create({ data: { eventDayId, parentId, scannedAt: t, recordedBy: user.id } });
  revalidateEvent(day.eventId);
  return {
    kind: existing ? "already" : "ok", name: `${parent.firstName} ${parent.lastName}`, role: "Parent",
    at: hhmm(existing?.scannedAt ?? t), photoUrl: null, present: await db.parentAttendance.count({ where: { eventDayId } }),
  };
}

/** Correction manuelle d'une présence à un événement (détail, US-1.10). */
export async function setEventAttendance(eventDayId: string, memberId: string, status: "PRESENT" | "ABSENT") {
  const user = await requirePermission("session.manage");
  const day = await db.eventDay.findUniqueOrThrow({ where: { id: eventDayId } });
  await db.attendance.upsert({
    where: { eventDayId_memberId: { eventDayId, memberId } },
    create: { eventDayId, memberId, status, scannedAt: status === "PRESENT" ? new Date() : null, mode: "MANUAL", recordedBy: user.id },
    update: { status, mode: "MANUAL", recordedBy: user.id, ...(status === "PRESENT" ? { scannedAt: new Date() } : {}) },
  });
  await db.auditLog.create({ data: { userId: user.id, action: "attendance.correct", entity: "EventDay", entityId: eventDayId, details: `${memberId} → ${status}` } });
  revalidateEvent(day.eventId);
}

// ─── Synchronisation des scans hors connexion (US-1.3 S) ───

export type OfflineScan = {
  id: string;
  kind: "session" | "eventDay";
  targetId: string;
  qr?: string;
  memberId?: string;
  departure?: boolean;
  at: string; // ISO, heure de scan d'origine
};

/**
 * Rejoue les scans stockés sur le téléphone. Les membres hors groupe / non inscrits sont ajoutés
 * (l'encadrant a scanné volontairement) ; les QR invalides sont signalés.
 */
export async function syncOfflineScans(items: OfflineScan[]) {
  const user = await requirePermission("session.manage");
  const done: string[] = [];
  const errors: { id: string; message: string }[] = [];
  for (const it of items.slice(0, 500)) {
    try {
      const input = { qr: it.qr, memberId: it.memberId, at: it.at, force: true, departure: it.departure };
      const r = it.kind === "session" ? await scan(it.targetId, input) : await scanEvent(it.targetId, input);
      if ("message" in r) errors.push({ id: it.id, message: r.message });
      done.push(it.id);
    } catch {
      // réessayé à la prochaine synchronisation
    }
  }
  if (done.length) {
    await db.auditLog.create({ data: { userId: user.id, action: "attendance.offlineSync", entity: "Attendance", details: `${done.length} scans` } });
  }
  return { done, errors };
}
