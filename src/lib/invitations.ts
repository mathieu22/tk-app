// Invitations, réinitialisation de mot de passe et codes SMS (US-7.1, 8.3, 9.1).
// Le jeton n'est jamais stocké en clair : seul son SHA-256 est en base.
import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { db } from "./db";
import { appUrl, sendMessage } from "./messaging";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const HOURS = 3600e3;

/** Crée un lien d'activation (INVITE) ou de réinitialisation (RESET) et l'envoie par SMS. */
export async function sendAccessLink(userId: string, kind: "INVITE" | "RESET", intro: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const token = randomBytes(24).toString("base64url");
  await db.authToken.deleteMany({ where: { userId, kind, usedAt: null } });
  await db.authToken.create({
    data: { userId, kind, tokenHash: sha256(token), expiresAt: new Date(Date.now() + (kind === "INVITE" ? 7 * 24 : 2) * HOURS) },
  });
  const link = appUrl(`/activation/${token}`);
  await sendMessage("SMS", user.phone, `${intro} ${link}`);
  if (user.email) await sendMessage("EMAIL", user.email, `${intro}\n\n${link}`, "Votre accès à l'application du club");
  return link;
}

/** Vérifie un lien (sans le consommer) ; renvoie l'enregistrement ou null. */
export async function checkAccessLink(token: string) {
  const t = await db.authToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!t || t.usedAt || t.expiresAt < new Date() || t.kind === "OTP") return null;
  return t;
}

export async function consumeAccessLink(id: string) {
  await db.authToken.update({ where: { id }, data: { usedAt: new Date() } });
}

/** Code SMS de connexion à 6 chiffres, valable 10 min, 5 essais. */
export async function sendLoginCode(userId: string, phone: string) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.authToken.deleteMany({ where: { userId, kind: "OTP", usedAt: null } });
  await db.authToken.create({ data: { userId, kind: "OTP", tokenHash: sha256(`${userId}:${code}`), expiresAt: new Date(Date.now() + 10 * 60e3) } });
  await sendMessage("SMS", phone, `Votre code de connexion : ${code} (valable 10 minutes).`);
}

export async function verifyLoginCode(userId: string, code: string) {
  const t = await db.authToken.findFirst({ where: { userId, kind: "OTP", usedAt: null }, orderBy: { createdAt: "desc" } });
  if (!t || t.expiresAt < new Date() || t.attempts >= 5) return false;
  if (t.tokenHash !== sha256(`${userId}:${code.trim()}`)) {
    await db.authToken.update({ where: { id: t.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  await db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  return true;
}
