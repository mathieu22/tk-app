"use server";
// Connexion (US-9.1) : mot de passe (téléphone ou email), code SMS, mot de passe oublié, activation.
// Aucun message ne révèle si un compte existe.
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { homeFor } from "@/lib/dal";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { checkAccessLink, consumeAccessLink, sendAccessLink, sendLoginCode, verifyLoginCode } from "@/lib/invitations";
import { createSession, deleteSession } from "@/lib/session";

// Hash factice : comparé quand le compte n'existe pas.
const DUMMY_HASH = "$2b$10$3roJzNjoZYguql7QMSUf9.2M9oAo/o8ToSo9j1Tt5THBKuqWG4HtS";

// ─── Limitation de débit ───
// Fenêtre glissante de 15 min, comptée en base (fonctionne aussi en serverless, sans nouveau modèle) :
// échecs de connexion = AuditLog « auth.fail », envois de SMS = OutboundMessage vers le numéro.
const WINDOW_MS = 15 * 60e3;
const MAX_FAILURES = 5;
const MAX_SMS = 3;
const since = () => new Date(Date.now() - WINDOW_MS);
const RATE_LIMITED = "Trop de tentatives. Réessayez dans 15 minutes.";

async function tooManyFailures(identifier: string) {
  const n = await db.auditLog.count({ where: { action: "auth.fail", details: identifier, at: { gte: since() } } });
  return n >= MAX_FAILURES;
}
async function recordFailure(identifier: string) {
  await db.auditLog.create({ data: { action: "auth.fail", entity: "User", details: identifier } });
}
async function tooManySms(phone: string) {
  const n = await db.outboundMessage.count({ where: { channel: "SMS", to: phone, createdAt: { gte: since() } } });
  return n >= MAX_SMS;
}

/** Identifiant : téléphone (normalisé +261…) ou email. */
function parseIdentifier(raw: string) {
  const t = raw.trim();
  if (t.includes("@")) return { key: t.toLowerCase(), where: { email: t.toLowerCase() } as const };
  const phone = normalizePhone(t);
  return phone ? { key: phone, where: { phone } as const } : null;
}

async function openSession(user: { id: string; profile: string }): Promise<never> {
  await createSession({ userId: user.id, profile: user.profile });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  redirect(homeFor(user.profile));
}

// ─── Mot de passe ───

export type LoginState = { error?: string; phone?: string } | undefined;

const schema = z.object({ phone: z.string().min(1), password: z.string().min(1) });

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Renseignez le téléphone et le mot de passe." };

  const rawPhone = parsed.data.phone;
  const id = parseIdentifier(rawPhone);
  if (id && (await tooManyFailures(id.key))) return { error: RATE_LIMITED, phone: rawPhone };
  const user = id ? await db.user.findUnique({ where: id.where }) : null;
  // Toujours comparer un hash pour ne pas révéler l'existence du compte par le temps de réponse.
  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash || DUMMY_HASH);
  if (!user || !user.active || !ok) {
    if (id) await recordFailure(id.key);
    return { error: "Identifiant ou mot de passe incorrect.", phone: rawPhone };
  }
  return openSession(user);
}

// ─── Code SMS (S) ───

export type CodeState = { step: "phone" | "code"; phone?: string; error?: string; info?: string };

const DEV_HINT = process.env.SMS_GATEWAY_URL ? "" : " (aucune passerelle SMS : voir Réglages → Messages)";

export async function requestCode(_: CodeState, formData: FormData): Promise<CodeState> {
  const raw = String(formData.get("phone") ?? "");
  const phone = normalizePhone(raw);
  if (!phone) return { step: "phone", phone: raw, error: "Numéro invalide (format +261 34 12 345 67)." };
  if (!(await tooManySms(phone))) {
    const user = await db.user.findUnique({ where: { phone } });
    if (user?.active) await sendLoginCode(user.id, phone);
  }
  return { step: "code", phone, info: `Si un compte existe pour ce numéro, un code a été envoyé${DEV_HINT}.` };
}

export async function verifyCode(_: CodeState, formData: FormData): Promise<CodeState> {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!phone) return { step: "phone", error: "Numéro invalide." };
  if (code.length !== 6) return { step: "code", phone, error: "Le code comporte 6 chiffres." };
  if (await tooManyFailures(phone)) return { step: "code", phone, error: RATE_LIMITED };
  const user = await db.user.findUnique({ where: { phone } });
  if (!user?.active || !(await verifyLoginCode(user.id, code))) {
    await recordFailure(phone);
    return { step: "code", phone, error: "Code incorrect ou expiré." };
  }
  return openSession(user);
}

// ─── Mot de passe oublié ───

export type ForgotState = { done?: boolean; error?: string } | undefined;

export async function forgotPassword(_: ForgotState, formData: FormData): Promise<ForgotState> {
  const id = parseIdentifier(String(formData.get("identifier") ?? ""));
  if (!id) return { error: "Saisissez votre téléphone ou votre email." };
  const user = await db.user.findUnique({ where: id.where });
  if (user?.active && !(await tooManySms(user.phone))) {
    await sendAccessLink(user.id, "RESET", "Réinitialisez votre mot de passe :");
  }
  // Réponse identique que le compte existe ou non.
  return { done: true };
}

// ─── Activation / réinitialisation ───

export type ActivateState = { error?: string } | undefined;

const passwordSchema = z
  .object({ password: z.string().min(8, "Au moins 8 caractères."), confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Les deux mots de passe diffèrent.", path: ["confirm"] });

export async function activate(token: string, _: ActivateState, formData: FormData): Promise<ActivateState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const link = await checkAccessLink(token);
  if (!link) return { error: "Ce lien n'est plus valide. Demandez une nouvelle invitation." };
  const user = await db.user.update({
    where: { id: link.userId },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 10), active: true },
  });
  await consumeAccessLink(link.id);
  // Un nouveau mot de passe invalide les autres liens en attente
  await db.authToken.deleteMany({ where: { userId: user.id, usedAt: null, kind: { in: ["INVITE", "RESET"] } } });
  await db.auditLog.create({ data: { userId: user.id, action: link.kind === "INVITE" ? "user.activate" : "user.reset", entity: "User", entityId: user.id } });
  return openSession(user);
}

export async function logout() {
  await deleteSession();
  redirect("/connexion");
}
