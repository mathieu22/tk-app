"use server";
// Comptes parents côté staff (US-7.1) : création, association aux athlètes, invitation.
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { normalizePhone } from "@/lib/format";
import { sendAccessLink } from "@/lib/invitations";
import { linkParent, RELATIONSHIPS, unlinkParent, type Relationship } from "@/lib/parents";

export type ParentFormState = { errors?: Record<string, string>; values?: Record<string, string> } | undefined;

const relationship = z.enum(Object.keys(RELATIONSHIPS) as [Relationship, ...Relationship[]]);
const schema = z.object({
  id: z.string().optional(),
  lastName: z.string().trim().min(1, "Nom obligatoire.").max(80),
  firstName: z.string().trim().min(1, "Prénom obligatoire.").max(80),
  phone: z.string().trim().min(1, "Téléphone obligatoire."),
  email: z.union([z.literal(""), z.email("Email invalide.")]),
  memberId: z.string().optional(),
  relationship: z.union([z.literal(""), relationship]).optional(),
  rank: z.enum(["1", "2"]).optional(),
});

const capitalize = (s: string) => s.replace(/(^|[\s-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());

export async function saveParent(_: ParentFormState, formData: FormData): Promise<ParentFormState> {
  const user = await requirePermission("parent.manage");
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { errors, values };
  }
  const d = parsed.data;
  const phone = normalizePhone(d.phone);
  if (!phone) return { errors: { phone: "Format attendu : +261 34 12 345 67." }, values };
  const clash = await db.parent.findUnique({ where: { phone } });
  if (clash && clash.id !== d.id) return { errors: { phone: `Déjà utilisé par ${clash.firstName} ${clash.lastName}.` }, values };

  const data = { lastName: d.lastName.toUpperCase(), firstName: capitalize(d.firstName), phone, email: d.email || null };
  const parent = d.id ? await db.parent.update({ where: { id: d.id }, data }) : await db.parent.create({ data });
  // Garder le compte utilisateur aligné (identifiant de connexion)
  if (parent.userId) {
    const other = await db.user.findUnique({ where: { phone } });
    if (!other || other.id === parent.userId) await db.user.update({ where: { id: parent.userId }, data: { phone, email: data.email } });
  }
  if (!d.id && d.memberId && d.relationship) {
    await linkParent(d.memberId, parent.id, d.relationship, d.rank === "2" ? 2 : 1, user.id);
  }
  await db.auditLog.create({ data: { userId: user.id, action: d.id ? "parent.update" : "parent.create", entity: "Parent", entityId: parent.id } });
  revalidatePath("/parents");
  redirect(`/parents/${parent.id}`);
}

export type LinkState = { error?: string } | undefined;

export async function linkChild(parentId: string, _: LinkState, formData: FormData): Promise<LinkState> {
  const user = await requirePermission("parent.manage");
  const memberId = String(formData.get("memberId") ?? "");
  const rel = relationship.safeParse(formData.get("relationship"));
  const rank = formData.get("rank") === "2" ? 2 : 1;
  if (!memberId || !rel.success) return { error: "Choisissez un athlète et le lien de parenté." };
  const member = await db.member.findUnique({ where: { id: memberId } });
  if (!member || member.archived) return { error: "Athlète introuvable." };
  await linkParent(memberId, parentId, rel.data, rank, user.id);
  revalidatePath(`/parents/${parentId}`);
  return undefined;
}

export async function unlinkChild(parentId: string, memberId: string) {
  const user = await requirePermission("parent.manage");
  await unlinkParent(memberId, parentId, user.id);
  revalidatePath(`/parents/${parentId}`);
}

export type InviteResult = { ok: true; link: string | null } | { ok: false; error: string };

/**
 * Invite un parent : crée si besoin son compte (profil PARENT, inactif jusqu'à l'activation)
 * et lui envoie le lien d'activation par SMS (et email).
 */
export async function inviteParent(parentId: string): Promise<InviteResult> {
  const user = await requirePermission("parent.manage");
  const parent = await db.parent.findUnique({ where: { id: parentId } });
  if (!parent) return { ok: false, error: "Parent introuvable." };

  let userId = parent.userId;
  if (!userId) {
    const existing = await db.user.findUnique({ where: { phone: parent.phone } });
    if (existing && (await db.parent.findUnique({ where: { userId: existing.id } }))) {
      return { ok: false, error: "Ce numéro est déjà lié à un autre compte parent." };
    }
    const account = existing ?? await db.user.create({
      data: {
        phone: parent.phone,
        email: parent.email && !(await db.user.findUnique({ where: { email: parent.email } })) ? parent.email : null,
        // Mot de passe inutilisable tant que le parent n'a pas activé son compte
        passwordHash: await bcrypt.hash(randomBytes(32).toString("base64url"), 10),
        profile: "PARENT",
        active: false,
      },
    });
    await db.parent.update({ where: { id: parent.id }, data: { userId: account.id } });
    userId = account.id;
  }
  const link = await sendAccessLink(userId, "INVITE", `Bonjour ${parent.firstName}, activez votre compte parent du club :`);
  await db.auditLog.create({ data: { userId: user.id, action: "parent.invite", entity: "Parent", entityId: parent.id } });
  revalidatePath(`/parents/${parentId}`);
  revalidatePath("/parents");
  // Sans passerelle SMS, le lien est rendu au staff pour qu'il le transmette lui-même.
  return { ok: true, link: process.env.SMS_GATEWAY_URL ? null : link };
}
