"use server";
// Réglages et administration (EPIC 8). Chaque action vérifie la permission côté serveur et journalise.
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { EVENT_ICONS } from "@/components/settings-defaults";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { PROFILES, RECURRING_FEES } from "@/lib/domain";
import { normalizePhone } from "@/lib/format";
import { sendAccessLink } from "@/lib/invitations";
import { sendMessage } from "@/lib/messaging";
import { DEFAULT_MATRIX, PERMISSIONS, type Permission } from "@/lib/permissions";
import { THEME_VARS } from "@/lib/theme";

/** `values` : saisie renvoyée en cas d'erreur (React réinitialise le formulaire après l'action). */
export type FormState = { ok?: string; error?: string; errors?: Record<string, string>; values?: Record<string, string> } | undefined;

const valuesOf = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string" && v.length < 2000).map(([k, v]) => [k, String(v)]));

const HEX = /^#[0-9a-f]{6}$/i;

async function audit(userId: string, action: string, entity: string, entityId?: string | null, details?: string) {
  await db.auditLog.create({ data: { userId, action, entity, entityId: entityId ?? null, details } });
}

function issues(error: z.ZodError, fd: FormData): FormState {
  const errors: Record<string, string> = {};
  for (const i of error.issues) errors[String(i.path[0])] ??= i.message;
  return { error: "Vérifiez les champs signalés.", errors, values: valuesOf(fd) };
}

// ─── US-8.1 Couleurs ───

export async function saveColors(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("settings");
  const association = await getAssociation();
  const colors: Record<string, string> = {};
  for (const key of Object.keys(THEME_VARS)) {
    const v = String(fd.get(key) ?? "").trim();
    if (!v) continue;
    if (!HEX.test(v)) return { error: `Couleur invalide pour ${THEME_VARS[key as keyof typeof THEME_VARS]} : ${v}` };
    colors[key] = v.toLowerCase();
  }
  const darkMode = fd.get("darkMode") === "on";
  await db.association.update({ where: { id: association.id }, data: { colors: JSON.stringify(colors), darkMode } });
  await audit(user.id, "settings.colors", "Association", association.id, `${Object.keys(colors).length} couleurs, sombre=${darkMode}`);
  revalidatePath("/", "layout");
  return { ok: "Couleurs enregistrées." };
}

export async function resetColors() {
  const user = await requirePermission("settings");
  const association = await getAssociation();
  await db.association.update({ where: { id: association.id }, data: { colors: "{}" } });
  await audit(user.id, "settings.colors", "Association", association.id, "rétablies par défaut");
  revalidatePath("/", "layout");
}

// ─── US-8.2 Association ───

const int = (min: number, max: number, msg: string) => z.coerce.number().int(msg).min(min, msg).max(max, msg);
const associationSchema = z
  .object({
    name: z.string().trim().min(1, "Le nom est obligatoire.").max(120),
    logoUrl: z.string().max(400_000, "Logo trop lourd.").refine((v) => v === "" || v.startsWith("data:image/"), "Logo invalide."),
    address: z.string().trim().max(300),
    phone: z.string().trim().max(30),
    email: z.union([z.literal(""), z.string().trim().email("Email invalide.")]),
    receiptFooter: z.string().trim().max(500),
    currentSchoolYear: z.string().regex(/^\d{4}-\d{4}$/, "Format AAAA-AAAA."),
    schoolYearStartMon: int(1, 12, "Mois entre 1 et 12."),
    newMemberDays: int(1, 365, "Entre 1 et 365 jours."),
    thresholdGreen: int(1, 100, "Entre 1 et 100."),
    thresholdOrange: int(0, 99, "Entre 0 et 99."),
    poomToDanAge: int(10, 30, "Entre 10 et 30 ans."),
    weightAlertKg: z.coerce.number().min(0, "Valeur positive.").max(10, "10 kg maximum."),
    weighInMaxDays: int(1, 365, "Entre 1 et 365 jours."),
    expenseApprovalMin: int(0, 1_000_000_000, "Montant invalide."),
  })
  .refine((d) => Number(d.currentSchoolYear.slice(5)) === Number(d.currentSchoolYear.slice(0, 4)) + 1, {
    path: ["currentSchoolYear"], message: "Deux années consécutives (ex. 2025-2026).",
  })
  .refine((d) => d.thresholdOrange < d.thresholdGreen, { path: ["thresholdOrange"], message: "Doit être inférieur au seuil vert." });

export async function saveAssociation(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("settings");
  const association = await getAssociation();
  const parsed = associationSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return issues(parsed.error, fd);
  const d = parsed.data;
  let phone: string | null = null;
  if (d.phone) {
    phone = normalizePhone(d.phone);
    if (!phone) return { error: "Vérifiez les champs signalés.", errors: { phone: "Téléphone invalide (+261 …)." }, values: valuesOf(fd) };
  }
  await db.association.update({
    where: { id: association.id },
    data: { ...d, logoUrl: d.logoUrl || null, address: d.address || null, phone, email: d.email || null, receiptFooter: d.receiptFooter || null },
  });
  await audit(user.id, "settings.association", "Association", association.id);
  revalidatePath("/", "layout");
  return { ok: "Paramètres enregistrés." };
}

// ─── US-8.2 Montants (tarifs par année scolaire, par groupe en S) ───

export async function saveTariffs(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("settings");
  const schoolYear = String(fd.get("schoolYear") ?? "");
  if (!/^\d{4}-\d{4}$/.test(schoolYear)) return { error: "Année scolaire invalide." };
  const applyToUnpaid = fd.get("applyToUnpaid") === "on";
  const feeTypes = await db.feeType.findMany({ where: { code: { in: [...RECURRING_FEES] } } });
  const groups = await db.group.findMany({ select: { id: true } });
  let changed = 0;

  for (const ft of feeTypes) {
    for (const groupId of [null, ...groups.map((g) => g.id)]) {
      const raw = String(fd.get(`amount_${ft.code}_${groupId ?? "all"}`) ?? "").replace(/\s/g, "");
      const existing = await db.tariff.findFirst({ where: { feeTypeId: ft.id, schoolYear, groupId } });
      if (raw === "") {
        // Un tarif de groupe vide = retour au tarif général ; le tarif général vide est conservé.
        if (existing && groupId) {
          await db.tariff.delete({ where: { id: existing.id } });
          changed++;
        }
        continue;
      }
      const amount = Number(raw);
      if (!Number.isInteger(amount) || amount < 0 || amount > 100_000_000) return { error: `Montant invalide pour ${ft.label}.`, values: valuesOf(fd) };
      if (existing?.amount === amount) continue;
      if (existing) await db.tariff.update({ where: { id: existing.id }, data: { amount } });
      else await db.tariff.create({ data: { feeTypeId: ft.id, schoolYear, groupId, amount } });
      changed++;

      if (applyToUnpaid) {
        // Échéances pas encore réglées : on aligne le montant dû (les paiements partiels ne sont pas touchés).
        // Tarif général : membres sans groupe ou dont le groupe n'a pas de tarif spécifique.
        const specific = groupId
          ? []
          : (await db.tariff.findMany({ where: { feeTypeId: ft.id, schoolYear, groupId: { not: null } }, select: { groupId: true } }))
              .map((t) => t.groupId as string);
        await db.due.updateMany({
          where: {
            feeTypeId: ft.id, schoolYear, amountPaid: 0, eventKey: "",
            member: groupId ? { groupId } : { OR: [{ groupId: null }, { groupId: { notIn: specific } }] },
          },
          data: { amountDue: amount },
        });
      }
    }
  }
  await audit(user.id, "settings.tariffs", "Tariff", null, `${schoolYear} : ${changed} modification(s)`);
  revalidatePath("/reglages/montants");
  revalidatePath("/cotisations", "layout");
  return { ok: changed ? `${changed} montant(s) enregistré(s).` : "Aucune modification." };
}

/** Prépare l'année scolaire suivante en recopiant les tarifs de l'année donnée. */
export async function createNextYearTariffs(schoolYear: string) {
  const user = await requirePermission("settings");
  if (!/^\d{4}-\d{4}$/.test(schoolYear)) return;
  const start = Number(schoolYear.slice(0, 4)) + 1;
  const next = `${start}-${start + 1}`;
  const tariffs = await db.tariff.findMany({ where: { schoolYear } });
  for (const t of tariffs) {
    const exists = await db.tariff.findFirst({ where: { feeTypeId: t.feeTypeId, schoolYear: next, groupId: t.groupId } });
    if (!exists) await db.tariff.create({ data: { feeTypeId: t.feeTypeId, schoolYear: next, groupId: t.groupId, amount: t.amount } });
  }
  await audit(user.id, "settings.tariffs", "Tariff", null, `${next} créée depuis ${schoolYear}`);
  redirect(`/reglages/montants?annee=${next}`);
}

// ─── US-8.2 Groupes d'entraînement ───

const nameSchema = z.string().trim().min(1, "Le nom est obligatoire.").max(60);

export async function saveGroup(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("settings");
  const id = String(fd.get("id") ?? "");
  const name = nameSchema.safeParse(fd.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };
  const description = String(fd.get("description") ?? "").trim().slice(0, 200) || null;
  const clash = await db.group.findFirst({ where: { name: name.data, NOT: id ? { id } : undefined } });
  if (clash) return { error: "Un groupe porte déjà ce nom." };
  if (id) await db.group.update({ where: { id }, data: { name: name.data, description } });
  else await db.group.create({ data: { name: name.data, description } });
  await audit(user.id, "settings.groups", "Group", id || null, name.data);
  revalidatePath("/reglages/groupes");
  return { ok: id ? "Groupe modifié." : "Groupe créé." };
}

export async function deleteGroup(id: string): Promise<FormState> {
  const user = await requirePermission("settings");
  const [members, sessions] = await Promise.all([db.member.count({ where: { groupId: id } }), db.session.count({ where: { groupId: id } })]);
  if (members || sessions) return { error: `Impossible : ${members} membre(s) et ${sessions} séance(s) utilisent ce groupe.` };
  await db.tariff.deleteMany({ where: { groupId: id } });
  await db.group.delete({ where: { id } });
  await audit(user.id, "settings.groups", "Group", id, "supprimé");
  revalidatePath("/reglages/groupes");
  return { ok: "Groupe supprimé." };
}

// ─── Types d'événements ───

export async function saveEventType(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("settings");
  const id = String(fd.get("id") ?? "");
  const label = nameSchema.safeParse(fd.get("label"));
  if (!label.success) return { error: label.error.issues[0].message };
  const icon = String(fd.get("icon") ?? "");
  const color = String(fd.get("color") ?? "");
  if (!(EVENT_ICONS as readonly string[]).includes(icon)) return { error: "Icône invalide." };
  if (!HEX.test(color)) return { error: "Couleur invalide." };
  const clash = await db.eventType.findFirst({ where: { label: label.data, NOT: id ? { id } : undefined } });
  if (clash) return { error: "Ce type existe déjà." };
  if (id) await db.eventType.update({ where: { id }, data: { label: label.data, icon, color } });
  else await db.eventType.create({ data: { label: label.data, icon, color } });
  await audit(user.id, "settings.eventTypes", "EventType", id || null, label.data);
  revalidatePath("/reglages/evenements");
  return { ok: id ? "Type modifié." : "Type créé." };
}

export async function deleteEventType(id: string): Promise<FormState> {
  const user = await requirePermission("settings");
  const n = await db.event.count({ where: { typeId: id } });
  if (n) return { error: `Impossible : ${n} événement(s) de ce type.` };
  await db.eventType.delete({ where: { id } });
  await audit(user.id, "settings.eventTypes", "EventType", id, "supprimé");
  revalidatePath("/reglages/evenements");
  return { ok: "Type supprimé." };
}

// ─── US-8.3 Utilisateurs ───

const userSchema = z.object({
  phone: z.string().min(1, "Le téléphone est obligatoire."),
  email: z.union([z.literal(""), z.string().trim().email("Email invalide.")]),
  profile: z.enum(PROFILES, { message: "Profil invalide." }),
  memberId: z.string(),
  invite: z.string().optional(),
});

/** Mot de passe inutilisable tant que l'invitation n'est pas activée. */
const unusableHash = () => bcrypt.hash(randomBytes(32).toString("hex"), 10);

export async function createUser(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requirePermission("user.manage");
  const parsed = userSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return issues(parsed.error, fd);
  const d = parsed.data;
  const phone = normalizePhone(d.phone);
  const fail = (errors: Record<string, string>) => ({ error: "Vérifiez les champs signalés.", errors, values: valuesOf(fd) });
  if (!phone) return fail({ phone: "Téléphone invalide (+261 …)." });
  if (await db.user.findUnique({ where: { phone } })) return fail({ phone: "Un compte existe déjà avec ce numéro." });
  if (d.email && (await db.user.findUnique({ where: { email: d.email } }))) return fail({ email: "Email déjà utilisé." });
  if (d.memberId) {
    const member = await db.member.findUnique({ where: { id: d.memberId }, include: { user: true } });
    if (!member) return fail({ memberId: "Membre introuvable." });
    if (member.user) return fail({ memberId: "Ce membre a déjà un compte." });
  }
  const user = await db.user.create({
    data: { phone, email: d.email || null, profile: d.profile, memberId: d.memberId || null, passwordHash: await unusableHash() },
  });
  await audit(admin.id, "user.create", "User", user.id, d.profile);
  if (d.invite === "on") {
    await sendAccessLink(user.id, "INVITE", "Bienvenue ! Activez votre compte de l'application du club :");
    await audit(admin.id, "user.invite", "User", user.id);
  }
  revalidatePath("/reglages/utilisateurs");
  redirect(`/reglages/utilisateurs/${user.id}`);
}

async function activeAdminsExcept(userId: string) {
  return db.user.count({ where: { profile: "ADMIN", active: true, NOT: { id: userId } } });
}

export async function changeProfile(userId: string, profile: string): Promise<FormState> {
  const admin = await requirePermission("user.manage");
  if (!(PROFILES as readonly string[]).includes(profile)) return { error: "Profil invalide." };
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.profile === profile) return { ok: "Aucune modification." };
  if (target.profile === "ADMIN" && target.active && (await activeAdminsExcept(userId)) === 0) {
    return { error: "Impossible : c'est le dernier administrateur actif." };
  }
  await db.user.update({ where: { id: userId }, data: { profile } });
  await audit(admin.id, "role.change", "User", userId, `${target.profile} → ${profile}`);
  revalidatePath(`/reglages/utilisateurs/${userId}`);
  revalidatePath("/reglages/utilisateurs");
  return { ok: "Profil modifié. Il s'applique à la prochaine requête de l'utilisateur." };
}

export async function setUserActive(userId: string, active: boolean): Promise<FormState> {
  const admin = await requirePermission("user.manage");
  if (userId === admin.id && !active) return { error: "Vous ne pouvez pas désactiver votre propre compte." };
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!active && target.profile === "ADMIN" && (await activeAdminsExcept(userId)) === 0) {
    return { error: "Impossible : c'est le dernier administrateur actif." };
  }
  await db.user.update({ where: { id: userId }, data: { active } });
  await audit(admin.id, active ? "user.activate" : "user.deactivate", "User", userId);
  revalidatePath(`/reglages/utilisateurs/${userId}`);
  revalidatePath("/reglages/utilisateurs");
  return { ok: active ? "Compte réactivé." : "Compte désactivé : l'utilisateur est déconnecté." };
}

export async function sendUserLink(userId: string, kind: "INVITE" | "RESET"): Promise<FormState> {
  const admin = await requirePermission("user.manage");
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!target.active) return { error: "Compte désactivé." };
  await sendAccessLink(
    userId,
    kind,
    kind === "INVITE" ? "Bienvenue ! Activez votre compte de l'application du club :" : "Réinitialisez votre mot de passe :",
  );
  await audit(admin.id, kind === "INVITE" ? "user.invite" : "user.reset", "User", userId);
  revalidatePath("/reglages/messages");
  return { ok: kind === "INVITE" ? "Invitation envoyée par SMS." : "Lien de réinitialisation envoyé par SMS." };
}

// ─── Matrice des permissions (§2.2) ───

export async function savePermissions(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("settings");
  const association = await getAssociation();
  const overrides: Record<string, string[]> = {};
  for (const perm of Object.keys(PERMISSIONS) as Permission[]) {
    const profiles = PROFILES.filter((p) => fd.get(`${perm}:${p}`) === "on");
    const def = DEFAULT_MATRIX[perm];
    const same = profiles.length === def.length && profiles.every((p) => def.includes(p));
    if (!same) overrides[perm] = profiles;
  }
  await db.association.update({ where: { id: association.id }, data: { permissions: JSON.stringify(overrides) } });
  await audit(user.id, "settings.permissions", "Association", association.id, Object.keys(overrides).join(", ") || "par défaut");
  revalidatePath("/", "layout");
  return { ok: `Matrice enregistrée (${Object.keys(overrides).length} permission(s) personnalisée(s)).` };
}

export async function resetPermissions() {
  const user = await requirePermission("settings");
  const association = await getAssociation();
  await db.association.update({ where: { id: association.id }, data: { permissions: "{}" } });
  await audit(user.id, "settings.permissions", "Association", association.id, "rétablie par défaut");
  revalidatePath("/", "layout");
}

// ─── Messages sortants ───

export async function resendMessage(id: string) {
  await requirePermission("settings");
  const m = await db.outboundMessage.findUniqueOrThrow({ where: { id } });
  if (m.channel !== "SMS" && m.channel !== "EMAIL") return;
  await sendMessage(m.channel, m.to, m.body, m.subject ?? undefined);
  revalidatePath("/reglages/messages");
}
