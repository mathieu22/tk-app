// Envoi de SMS / emails (US-7.1 invitations, 7.3 notifications, 9.1 codes SMS).
// Tous les messages passent par la table OutboundMessage. Sans passerelle configurée
// (SMS_GATEWAY_URL absent), ils y restent en « QUEUED » : consultables dans Réglages → Messages.
import "server-only";
import { db } from "./db";

export async function sendMessage(channel: "SMS" | "EMAIL", to: string, body: string, subject?: string) {
  const msg = await db.outboundMessage.create({ data: { channel, to, body, subject } });
  const url = channel === "SMS" ? process.env.SMS_GATEWAY_URL : process.env.EMAIL_GATEWAY_URL;
  if (!url) return msg;
  try {
    // Passerelle générique : POST JSON { to, body, subject } avec jeton Bearer optionnel.
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.GATEWAY_TOKEN ? { authorization: `Bearer ${process.env.GATEWAY_TOKEN}` } : {}),
      },
      body: JSON.stringify({ to, body, subject }),
      signal: AbortSignal.timeout(10_000),
    });
    await db.outboundMessage.update({
      where: { id: msg.id },
      data: res.ok ? { status: "SENT" } : { status: "FAILED", error: `HTTP ${res.status}` },
    });
  } catch (e) {
    await db.outboundMessage.update({ where: { id: msg.id }, data: { status: "FAILED", error: String(e).slice(0, 500) } });
  }
  return msg;
}

/** URL absolue de l'application (liens d'invitation, partages). */
export function appUrl(path = "/") {
  const base = process.env.APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return new URL(path, base).toString();
}
