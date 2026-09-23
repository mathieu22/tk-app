"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { expectedMembersWhere } from "@/lib/attendance";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { fullName, POSITIONS, type Position } from "@/lib/domain";
import { parseQrPayload } from "@/lib/qr";

// ─── Création de séance (US-1.2) ───

export type SessionFormState = { errors?: Record<string, string>; values?: Record<string, string> } | undefined;

const time = z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]);
const sessionSchema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire.").max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  startTime: time,
  endTime: time,
  groupId: z.string(),
  location: z.string().trim().max(120),
  intent: z.enum(["save", "scan"]),
});

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

  const session = await db.session.create({
    data: {
      title: d.title,
      date: new Date(`${d.date}T00:00:00`),
      startTime: d.startTime || null,
      endTime: d.endTime || null,
      groupId: d.groupId || null,
      location: d.location || null,
      createdById: user.id,
    },
  });
  revalidatePath("/presence");
  redirect(d.intent === "scan" ? `/presence/${session.id}/scanner` : `/presence/${session.id}`);
}

// ─── Scan QR (US-1.3) ───

export type ScanResult =
  | { kind: "ok" | "already"; name: string; role: string; at: string; photoUrl: string | null; present: number }
  | { kind: "outOfGroup"; name: string; role: string; memberId: string }
  | { kind: "invalid" | "closed"; message: string };

const hhmm = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

async function markPresent(sessionId: string, memberId: string, mode: "QR" | "MANUAL", recordedBy: string) {
  const existing = await db.attendance.findUnique({ where: { sessionId_memberId: { sessionId, memberId } } });
  if (existing?.status === "PRESENT") return { already: true, at: existing.scannedAt ?? new Date() };
  const at = new Date();
  await db.attendance.upsert({
    where: { sessionId_memberId: { sessionId, memberId } },
    create: { sessionId, memberId, status: "PRESENT", scannedAt: at, mode, recordedBy },
    update: { status: "PRESENT", scannedAt: at, mode, recordedBy },
  });
  return { already: false, at };
}

/**
 * Enregistre la présence d'un membre à partir du texte d'un QR code, ou d'un id
 * (saisie manuelle / confirmation d'un membre hors groupe).
 */
export async function scan(sessionId: string, input: { qr?: string; memberId?: string; force?: boolean }): Promise<ScanResult> {
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

  const { already, at } = await markPresent(session.id, member.id, input.qr !== undefined ? "QR" : "MANUAL", user.id);
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

// ─── Correction manuelle / clôture (US-1.4, US-1.5) ───

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

export async function toggleSessionClosed(sessionId: string) {
  await requirePermission("session.manage");
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  await db.session.update({ where: { id: s.id }, data: { status: s.status === "OPEN" ? "CLOSED" : "OPEN" } });
  revalidatePath(`/presence/${sessionId}`);
  revalidatePath("/presence");
}
