// Notifications aux parents et athlètes (US-7.3) : in-app + SMS selon les préférences.
import "server-only";
import { db } from "./db";
import { sendMessage } from "./messaging";

export const NOTIFICATION_KINDS = {
  ABSENCE: "Absence à une séance",
  PAYMENT: "Paiement enregistré",
  OVERDUE: "Cotisation en retard",
  GRADE: "Nouveau grade",
  RESULT: "Nouveau résultat",
  EVENT: "Événement",
} as const;
export type NotificationKind = keyof typeof NOTIFICATION_KINDS;

/** Préférences : { ABSENCE: { app: true, sms: false }, … } — in-app activé et SMS désactivé par défaut. */
export function prefsOf(json: string) {
  let raw: Record<string, { app?: boolean; sms?: boolean }> = {};
  try { raw = JSON.parse(json || "{}"); } catch { /* défaut */ }
  return (kind: NotificationKind) => ({ app: raw[kind]?.app ?? true, sms: raw[kind]?.sms ?? false });
}

/** Notifie l'athlète (s'il a un compte) et les parents associés d'un membre. */
export async function notifyMember(memberId: string, kind: NotificationKind, title: string, body: string, url?: string) {
  const [self, links] = await Promise.all([
    db.user.findFirst({ where: { memberId, active: true } }),
    db.parentLink.findMany({ where: { memberId }, include: { parent: { include: { user: true } } } }),
  ]);
  const users = [self, ...links.map((l) => l.parent.user)].filter((u): u is NonNullable<typeof u> => !!u && u.active);
  for (const u of users) {
    const p = prefsOf(u.notificationPrefs)(kind);
    if (p.app) await db.notification.create({ data: { userId: u.id, kind, title, body, url } });
    if (p.sms) await sendMessage("SMS", u.phone, `${title} — ${body}`);
  }
}
