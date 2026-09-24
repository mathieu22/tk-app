"use server";
// Actions de l'espace parent / athlète (US-7.2, 7.3, 9.3). Toujours limitées aux membres visibles.
// La réponse aux événements (US-1.8) est dans @/app/actions/events (`respondToEvent`, module F1).
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isMinor } from "@/lib/categories";
import { db } from "@/lib/db";
import { requireUser, visibleMemberIds } from "@/lib/dal";
import { NOTIFICATION_KINDS, type NotificationKind } from "@/lib/notify";

async function assertVisible(memberId: string) {
  const user = await requireUser();
  const ids = await visibleMemberIds(user);
  if (ids !== "ALL" && !ids.includes(memberId)) throw new Error("Accès refusé.");
  return user;
}

// ─── Notifications (US-7.3) ───

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await db.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/mon-espace", "layout");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/mon-espace", "layout");
}

export type PrefsState = { saved?: boolean } | undefined;

export async function savePreferences(_: PrefsState, formData: FormData): Promise<PrefsState> {
  const user = await requireUser();
  const prefs: Record<string, { app: boolean; sms: boolean }> = {};
  for (const kind of Object.keys(NOTIFICATION_KINDS) as NotificationKind[]) {
    prefs[kind] = { app: formData.get(`${kind}.app`) === "on", sms: formData.get(`${kind}.sms`) === "on" };
  }
  await db.user.update({ where: { id: user.id }, data: { notificationPrefs: JSON.stringify(prefs) } });
  revalidatePath("/mon-espace/preferences");
  return { saved: true };
}

// ─── Profil ───

export type PasswordState = { error?: string; saved?: boolean } | undefined;

const passwordSchema = z
  .object({ current: z.string().min(1, "Saisissez votre mot de passe actuel."), password: z.string().min(8, "Au moins 8 caractères."), confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Les deux mots de passe diffèrent.", path: ["confirm"] });

export async function changePassword(_: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(parsed.data.current, row.passwordHash))) return { error: "Mot de passe actuel incorrect." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) } });
  await db.auditLog.create({ data: { userId: user.id, action: "user.password", entity: "User", entityId: user.id } });
  return { saved: true };
}

/** Consentement à l'utilisation des photos (US-9.3), donné par le parent ou l'athlète majeur. */
export async function setPhotoConsent(memberId: string, consent: boolean) {
  const user = await assertVisible(memberId);
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { birthDate: true } });
  // Un athlète mineur ne peut pas donner seul son consentement : c'est au tuteur.
  if (user.profile === "ATHLETE" && isMinor(member.birthDate)) throw new Error("Consentement réservé au tuteur.");
  await db.member.update({ where: { id: memberId }, data: { photoConsent: consent } });
  await db.auditLog.create({ data: { userId: user.id, action: "member.photoConsent", entity: "Member", entityId: memberId, details: String(consent) } });
  revalidatePath("/mon-espace/profil");
}
