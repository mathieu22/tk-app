"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { expectedMembersWhere } from "@/lib/attendance";
import { db } from "@/lib/db";
import { requirePermission, requireStaff } from "@/lib/dal";
import { fullName, POSITIONS, type Position } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { notifyMember } from "@/lib/notify";
import { parseQrPayload } from "@/lib/qr";

// ─── Création de séance (US-1.2), récurrence (US-1.2 S) ───

export type SessionFormState = { errors?: Record<string, string>; values?: Record<string, string> } | undefined;

const time = z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]);
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const sessionSchema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire.").max(120),
  date: z.string().regex(dateRe, "Date invalide."),
  startTime: time,
  endTime: time,
  groupId: z.string(),
  location: z.string().trim().max(120),
  intent: z.enum(["save", "scan"]),
  repeat: z.enum(["", "on"]).default(""),
  weekdays: z.string().default(""), // "2,4" (1 = lundi … 7 = dimanche)
  until: z.union([z.literal(""), z.string().regex(dateRe, "Date invalide.")]).default(""),
});

const MAX_SERIES = 120;

/** Dates de la série : jours de semaine choisis, de la date de début à la date de fin incluses. */
function seriesDates(start: Date, until: Date, weekdays: number[]) {
  const out: Date[] = [];
  for (const d = new Date(start); d <= until && out.length <= MAX_SERIES; d.setDate(d.getDate() + 1)) {
    const iso = d.getDay() === 0 ? 7 : d.getDay();
    if (weekdays.includes(iso)) out.push(new Date(d));
  }
  return out;
}

export async function createSession(_: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const user = await requirePermission("session.manage");
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = sessionSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors, values };
  }
  const d = parsed.data;
  if (d.startTime && d.endTime && d.endTime <= d.startTime) {
    return { errors: { endTime: "L'heure de fin doit suivre l'heure de début." }, values };
  }
  if (d.groupId && !(await db.group.findUnique({ where: { id: d.groupId } }))) {
    return { errors: { groupId: "Groupe inconnu." }, values };
  }
  const start = new Date(`${d.date}T00:00:00`);
  let dates = [start];
  let seriesId: string | null = null;
  if (d.repeat === "on") {
    const weekdays = d.weekdays.split(",").map(Number).filter((n) => n >= 1 && n <= 7);
    if (!weekdays.length) return { errors: { weekdays: "Choisissez au moins un jour." }, values };
    if (!d.until) return { errors: { until: "Indiquez la date de fin de la série." }, values };
    const until = new Date(`${d.until}T00:00:00`);
    if (until <= start) return { errors: { until: "La fin de la série doit suivre la première date." }, values };
    dates = seriesDates(start, until, weekdays);
    if (dates.length > MAX_SERIES) return { errors: { until: `${MAX_SERIES} séances maximum par série.` }, values };
    if (!dates.length) return { errors: { weekdays: "Aucune date ne correspond à ces jours." }, values };
    seriesId = randomUUID();
  }

  const base = {
    title: d.title,
    startTime: d.startTime || null,
    endTime: d.endTime || null,
    groupId: d.groupId || null,
    location: d.location || null,
    createdById: user.id,
    seriesId,
  };
  await db.session.createMany({ data: dates.map((date) => ({ ...base, date })) });
  const first = await db.session.findFirstOrThrow({
    where: { title: d.title, date: dates[0], createdById: user.id, seriesId },
    orderBy: { createdAt: "desc" },
  });
  if (seriesId) {
    await db.auditLog.create({ data: { userId: user.id, action: "session.series", entity: "Session", entityId: first.id, details: `${dates.length} séances` } });
  }
  revalidatePath("/presence");
  revalidatePath("/calendrier");
  redirect(d.intent === "scan" ? `/presence/${first.id}/scanner` : `/presence/${first.id}`);
}

// ─── Scan QR (US-1.3) ───

export type ScanResult =
  | { kind: "ok" | "already"; name: string; role: string; at: string; photoUrl: string | null; present: number; title?: string }
  | { kind: "outOfGroup"; name: string; role: string; memberId: string; reason?: string }
  | { kind: "invalid" | "closed"; message: string };

const hhmm = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Heure de scan d'origine (mode hors connexion) : bornée entre J-7 et maintenant. */
function scanTime(at?: string) {
  const now = new Date();
  if (!at) return now;
  const t = new Date(at);
  if (Number.isNaN(t.getTime()) || t > now || now.getTime() - t.getTime() > 7 * 86400e3) return now;
  return t;
}

async function markPresent(sessionId: string, memberId: string, mode: "QR" | "MANUAL", recordedBy: string, at: Date) {
  const existing = await db.attendance.findUnique({ where: { sessionId_memberId: { sessionId, memberId } } });
  if (existing?.status === "PRESENT") return { already: true, at: existing.scannedAt ?? at };
  await db.attendance.upsert({
    where: { sessionId_memberId: { sessionId, memberId } },
    create: { sessionId, memberId, status: "PRESENT", scannedAt: at, mode, recordedBy },
    update: { status: "PRESENT", scannedAt: at, mode, recordedBy },
  });
  return { already: false, at };
}

/**
 * Enregistre la présence d'un membre à partir du texte d'un QR code, ou d'un id
 * (saisie manuelle / confirmation d'un membre hors groupe). `at` : heure d'un scan hors connexion.
 */
export async function scan(sessionId: string, input: { qr?: string; memberId?: string; force?: boolean; at?: string }): Promise<ScanResult> {
  const user = await requirePermission("session.manage");
  const session = await db.session.findUnique({ where: { id: sessionId } });
  if (!session) return { kind: "invalid", message: "Séance introuvable." };
  if (session.status === "CLOSED") return { kind: "closed", message: "Séance clôturée : scan impossible." };

  let member;
  if (input.qr !== undefined) {
    const token = parseQrPayload(input.qr);
    member = token ? await db.member.findUnique({ where: { qrToken: token } }) : null;
  } else if (input.memberId) {
    member = await db.member.findUnique({ where: { id: input.memberId } });
  }
  if (!member || member.archived) return { kind: "invalid", message: "QR code inconnu ou invalide." };

  const name = fullName(member);
  const role = POSITIONS[member.position as Position] ?? member.position;
  const inGroup = !session.groupId || member.groupId === session.groupId;
  if ((!inGroup || member.status !== "ACTIVE") && !input.force) {
    return { kind: "outOfGroup", name, role, memberId: member.id };
  }

  const { already, at } = await markPresent(session.id, member.id, input.qr !== undefined ? "QR" : "MANUAL", user.id, scanTime(input.at));
  const present = await db.attendance.count({ where: { sessionId, status: "PRESENT" } });
  revalidatePath(`/presence/${sessionId}`);
  return { kind: already ? "already" : "ok", name, role, at: hhmm(at), photoUrl: member.photoUrl, present };
}

/** Liste pour la saisie manuelle dans le scanner. */
export async function searchMembers(sessionId: string, q: string) {
  await requirePermission("session.manage");
  const session = await db.session.findUnique({ where: { id: sessionId }, select: { groupId: true } });
  if (!session || q.trim().length < 2) return [];
  const members = await db.member.findMany({
    where: {
      ...expectedMembersWhere(null),
      OR: [{ lastName: { contains: q.trim().toUpperCase() } }, { firstName: { contains: q.trim() } }],
    },
    take: 8,
    orderBy: { lastName: "asc" },
  });
  return members.map((m) => ({ id: m.id, name: fullName(m), role: POSITIONS[m.position as Position] ?? m.position }));
}

// ─── Correction manuelle / clôture / suppression (US-1.4, US-1.5) ───

export async function setAttendance(sessionId: string, memberId: string, status: "PRESENT" | "ABSENT" | "EXCUSED") {
  const user = await requirePermission("session.manage");
  const session = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  const at = status === "PRESENT" ? new Date() : null;
  await db.attendance.upsert({
    where: { sessionId_memberId: { sessionId: session.id, memberId } },
    create: { sessionId: session.id, memberId, status, scannedAt: at, mode: "MANUAL", recordedBy: user.id },
    update: { status, mode: "MANUAL", recordedBy: user.id, ...(status === "PRESENT" ? { scannedAt: at } : {}) },
  });
  await db.auditLog.create({
    data: { userId: user.id, action: "attendance.correct", entity: "Session", entityId: session.id, details: `${memberId} → ${status}` },
  });
  revalidatePath(`/presence/${sessionId}`);
}

/**
 * Clôture / réouverture. À la première clôture, les familles des absents sont notifiées (US-7.3).
 */
export async function toggleSessionClosed(sessionId: string) {
  const user = await requirePermission("session.manage");
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  const closing = s.status === "OPEN";
  await db.session.update({ where: { id: s.id }, data: { status: closing ? "CLOSED" : "OPEN" } });
  if (closing) {
    const already = await db.auditLog.findFirst({ where: { action: "session.absenceNotified", entityId: s.id } });
    if (!already) {
      const [expected, marked] = await Promise.all([
        db.member.findMany({ where: expectedMembersWhere(s.groupId), select: { id: true, firstName: true, lastName: true } }),
        db.attendance.findMany({ where: { sessionId: s.id, status: { in: ["PRESENT", "EXCUSED"] } }, select: { memberId: true } }),
      ]);
      const ok = new Set(marked.map((m) => m.memberId));
      const absents = expected.filter((m) => !ok.has(m.id));
      for (const m of absents) {
        await notifyMember(m.id, "ABSENCE", "Absence à une séance", `${fullName(m)} était absent(e) à « ${s.title} » du ${formatDate(s.date)}.`, "/mon-espace");
      }
      await db.auditLog.create({ data: { userId: user.id, action: "session.absenceNotified", entity: "Session", entityId: s.id, details: `${absents.length} absents` } });
    }
  }
  revalidatePath(`/presence/${sessionId}`);
  revalidatePath("/presence");
}

/** Suppression réservée à l'administrateur et au Président (US-1.5) ; `series` : toute la série à venir. */
export async function deleteSession(sessionId: string, scope: "one" | "series" = "one") {
  const user = await requireStaff();
  if (!["ADMIN", "PRESIDENT"].includes(user.profile)) return { error: "Suppression réservée à l'administrateur et au Président." };
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  const where = scope === "series" && s.seriesId ? { seriesId: s.seriesId, date: { gte: s.date } } : { id: s.id };
  const { count } = await db.session.deleteMany({ where });
  await db.auditLog.create({ data: { userId: user.id, action: "session.delete", entity: "Session", entityId: s.id, details: `${s.title} (${count})` } });
  revalidatePath("/presence");
  revalidatePath("/calendrier");
  redirect("/presence");
}
