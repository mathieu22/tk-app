"use server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nextMatricule } from "@/app/(app)/membres/_lib";
import { ageAt, isMinor } from "@/lib/categories";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { BLOOD_GROUPS, BOARD_POSITIONS, fullName, MEMBER_STATUSES, POSITIONS, type Position } from "@/lib/domain";
import { normalizePhone } from "@/lib/format";
import { sendAccessLink } from "@/lib/invitations";
import { findOrCreateParent, linkParent, RELATIONSHIPS, searchParents, unlinkParent, type Relationship } from "@/lib/parents";
import { newQrToken } from "@/lib/qr";

export type MemberFormState =
  | { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | undefined;

const optional = z.string().trim().transform((v) => v || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide").transform((v) => new Date(`${v}T00:00:00`));
const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const schema = z.object({
  id: z.string().optional(),
  lastName: z.string().trim().min(1, "Nom obligatoire").max(80).transform((v) => v.toUpperCase()),
  firstName: z
    .string()
    .trim()
    .min(1, "Prénom obligatoire")
    .max(80)
    .transform((v) => v.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase())),
  sex: z.enum(["M", "F"], { message: "Sexe obligatoire" }),
  birthDate: date,
  birthPlace: optional,
  nationality: z.string().trim().default("Malagasy").transform((v) => v || "Malagasy"),
  phone: optional,
  email: optional.pipe(z.email("Email invalide").nullable()),
  facebook: optional,
  address: optional,
  position: z.enum(Object.keys(POSITIONS) as [Position, ...Position[]], { message: "Poste obligatoire" }),
  status: z.enum(Object.keys(MEMBER_STATUSES) as [string, ...string[]]),
  joinedAt: date,
  groupId: optional,
  bloodGroup: optional.pipe(z.enum(BLOOD_GROUPS).nullable()),
  medicalInfo: optional,
  photoUrl: z.string().max(400_000, "Photo trop lourde").refine((v) => !v || IMAGE.test(v), "Photo invalide").transform((v) => v || null),
  photoConsent: z.string().optional().transform((v) => v === "on"),
  licenseNo: optional,
  kukkiwonNo: optional,
  gradeId: optional,
  gradeDate: z.string().optional().transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : null)),
  weightKg: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v.replace(",", ".")) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v > 5 && v < 250), "Poids invalide"),
});

/** Tuteur saisi dans le formulaire : parent existant (parentId) ou nouvelle fiche. */
const tutorSchema = z.object({
  parentId: z.string().trim(),
  lastName: z.string().trim().max(80),
  firstName: z.string().trim().max(80),
  phone: z.string().trim(),
  email: z.string().trim().max(120),
  relationship: z.enum(Object.keys(RELATIONSHIPS) as [Relationship, ...Relationship[]]).catch("OTHER"),
});
type TutorInput = z.infer<typeof tutorSchema>;

function readTutor(raw: Record<string, string>, prefix: "t1" | "t2"): TutorInput | null {
  const t = tutorSchema.parse({
    parentId: raw[`${prefix}_parentId`] ?? "",
    lastName: raw[`${prefix}_lastName`] ?? "",
    firstName: raw[`${prefix}_firstName`] ?? "",
    phone: raw[`${prefix}_phone`] ?? "",
    email: raw[`${prefix}_email`] ?? "",
    relationship: raw[`${prefix}_relationship`] ?? "OTHER",
  });
  return t.parentId || t.lastName || t.phone ? t : null;
}

export async function saveMember(_: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const user = await requirePermission("member.edit");
  const raw = Object.fromEntries([...formData].filter(([k, v]) => !k.startsWith("$") && typeof v === "string")) as Record<string, string>;
  // Les valeurs saisies sont renvoyées pour que React ne vide pas le formulaire en cas d'erreur (sans la photo, trop lourde).
  const { photoUrl: _photo, ...echo } = raw;
  void _photo;
  const fail = (state: Omit<NonNullable<MemberFormState>, "values">): MemberFormState => ({ ...state, values: echo });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return fail({ error: "Vérifiez les champs signalés.", fieldErrors });
  }
  const { id, phone: rawPhone, gradeId, gradeDate, weightKg, ...data } = parsed.data;
  const minor = isMinor(data.birthDate);

  // Tuteurs (US-2.5) : Tuteur 1 obligatoire pour un mineur.
  const tutors = { 1: readTutor(raw, "t1"), 2: readTutor(raw, "t2") } as const;
  const tutorErrors: Record<string, string> = {};
  for (const rank of [1, 2] as const) {
    const t = tutors[rank];
    if (!t || t.parentId) continue;
    if (!t.lastName || !t.firstName) tutorErrors[`t${rank}`] = "Nom et prénom du tuteur obligatoires";
    else if (!normalizePhone(t.phone)) tutorErrors[`t${rank}`] = "Téléphone du tuteur invalide (+261 …)";
    else if (t.email && !z.email().safeParse(t.email).success) tutorErrors[`t${rank}`] = "Email du tuteur invalide";
  }
  if (minor && !tutors[1]) tutorErrors.t1 = "Tuteur 1 obligatoire pour un mineur";
  if (Object.keys(tutorErrors).length) return fail({ error: "Vérifiez les tuteurs.", fieldErrors: tutorErrors });

  // Téléphone : obligatoire sauf pour un mineur ayant un tuteur.
  let phone: string | null = null;
  if (rawPhone) {
    phone = normalizePhone(rawPhone);
    if (!phone) return fail({ fieldErrors: { phone: "Numéro invalide (ex. +261 34 12 345 67)" } });
  } else if (!minor) {
    return fail({ fieldErrors: { phone: "Téléphone obligatoire pour un majeur" } });
  }

  const duplicate = await db.member.findFirst({
    where: {
      archived: false,
      id: id ? { not: id } : undefined,
      OR: [
        { lastName: data.lastName, firstName: data.firstName, birthDate: data.birthDate },
        ...(phone ? [{ phone }] : []),
      ],
    },
    select: { matricule: true, firstName: true, lastName: true },
  });
  if (duplicate) {
    return fail({ error: `Doublon possible : ${duplicate.firstName} ${duplicate.lastName} (${duplicate.matricule}) a le même nom et date de naissance, ou le même téléphone.` });
  }

  if (BOARD_POSITIONS.includes(data.position) && data.status === "ACTIVE") {
    const holder = await db.member.findFirst({
      where: { position: data.position, status: "ACTIVE", archived: false, id: id ? { not: id } : undefined },
      select: { firstName: true, lastName: true },
    });
    if (holder) {
      return fail({ fieldErrors: { position: `Poste déjà occupé par ${holder.firstName} ${holder.lastName}` } });
    }
  }

  if (data.groupId && !(await db.group.findUnique({ where: { id: data.groupId } }))) {
    return fail({ fieldErrors: { groupId: "Groupe inconnu" } });
  }
  const grade = gradeId ? await db.grade.findUnique({ where: { id: gradeId } }) : null;
  if (gradeId && !grade) return fail({ fieldErrors: { gradeId: "Grade inconnu" } });

  // Parents : résolus avant l'écriture du membre pour ne rien créer à moitié en cas d'erreur.
  const parentIds: Partial<Record<1 | 2, string>> = {};
  for (const rank of [1, 2] as const) {
    const t = tutors[rank];
    if (!t) continue;
    if (t.parentId) {
      const p = await db.parent.findUnique({ where: { id: t.parentId } });
      if (!p) return fail({ fieldErrors: { [`t${rank}`]: "Tuteur introuvable" } });
      parentIds[rank] = p.id;
    } else {
      parentIds[rank] = (await findOrCreateParent({ lastName: t.lastName, firstName: t.firstName, phone: t.phone, email: t.email || null })).id;
    }
  }
  if (parentIds[1] && parentIds[1] === parentIds[2]) {
    return fail({ fieldErrors: { t2: "Le Tuteur 2 doit être différent du Tuteur 1" } });
  }

  const values = { ...data, phone };
  let memberId = id;
  if (id) {
    const existing = await db.member.findUnique({ where: { id } });
    if (!existing || existing.archived) return fail({ error: "Membre introuvable." });
    await db.member.update({ where: { id }, data: values });
    await db.auditLog.create({ data: { userId: user.id, action: "member.update", entity: "Member", entityId: id } });
  } else {
    const created = await db.member.create({ data: { ...values, matricule: await nextMatricule(), qrToken: newQrToken() } });
    memberId = created.id;
    await db.auditLog.create({ data: { userId: user.id, action: "member.create", entity: "Member", entityId: created.id } });
  }

  // Liens tuteurs (rang 1 = contact principal)
  const currentLinks = await db.parentLink.findMany({ where: { memberId } });
  for (const rank of [1, 2] as const) {
    const pid = parentIds[rank];
    if (pid) await linkParent(memberId!, pid, tutors[rank]!.relationship, rank, user.id);
    else for (const l of currentLinks.filter((l) => l.rank === rank)) await unlinkParent(memberId!, l.parentId, user.id);
  }

  // Grade déjà acquis (création ou changement explicite)
  if (grade) {
    const last = await db.gradePassage.findFirst({ where: { memberId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
    if (last?.gradeId !== grade.id) {
      await db.gradePassage.create({
        data: { memberId: memberId!, gradeId: grade.id, date: gradeDate ?? new Date(), observation: "Saisi depuis la fiche membre", recordedById: user.id },
      });
    }
  }
  // Pesée datée (US-2.5, US-5.5) si le poids a changé
  if (weightKg !== null) {
    const last = await db.weighIn.findFirst({ where: { memberId }, orderBy: { date: "desc" } });
    if (last?.weightKg !== weightKg) await db.weighIn.create({ data: { memberId: memberId!, weightKg, recordedById: user.id } });
  }

  revalidatePath("/membres");
  revalidatePath(`/membres/${memberId}`);
  redirect(`/membres/${memberId}`);
}

/** Autocomplétion des tuteurs existants (par nom ou téléphone). */
export async function findParents(q: string) {
  await requirePermission("member.edit");
  const list = await searchParents(q);
  return list.map((p) => ({ id: p.id, lastName: p.lastName, firstName: p.firstName, phone: p.phone, email: p.email }));
}

/** Mot de passe inutilisable : le compte est activé via le lien d'invitation. */
const unusablePassword = () => bcrypt.hash(randomBytes(32).toString("base64url"), 10);

/** Invite un tuteur : crée si besoin son compte PARENT puis envoie le lien d'activation (US-7.1). */
export async function inviteParent(parentId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requirePermission("member.edit");
  const parent = await db.parent.findUnique({ where: { id: parentId }, include: { user: true } });
  if (!parent) return { ok: false, message: "Tuteur introuvable." };
  let account = parent.user;
  if (!account) {
    const byPhone = await db.user.findUnique({ where: { phone: parent.phone } });
    if (byPhone && byPhone.profile !== "PARENT") return { ok: false, message: "Ce téléphone est déjà utilisé par un autre compte." };
    account = byPhone ?? (await db.user.create({ data: { phone: parent.phone, email: parent.email, passwordHash: await unusablePassword(), profile: "PARENT" } }));
    await db.parent.update({ where: { id: parent.id }, data: { userId: account.id } });
  }
  if (account.lastLoginAt) return { ok: false, message: "Ce compte est déjà activé." };
  await sendAccessLink(account.id, "INVITE", `Bonjour ${parent.firstName}, votre accès parent à l'application du club :`);
  await db.auditLog.create({ data: { userId: user.id, action: "parent.invite", entity: "Parent", entityId: parent.id } });
  return { ok: true, message: `Invitation envoyée au ${parent.phone}.` };
}

/** Compte athlète à la majorité (US-2.5 règle tuteurs). */
export async function createAthleteAccount(memberId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requirePermission("member.edit");
  const m = await db.member.findUnique({ where: { id: memberId }, include: { user: true } });
  if (!m || m.archived) return { ok: false, message: "Membre introuvable." };
  if (m.user) return { ok: false, message: "Ce membre a déjà un compte." };
  if (ageAt(m.birthDate) < 18) return { ok: false, message: "Le compte athlète est proposé à partir de 18 ans." };
  if (!m.phone) return { ok: false, message: "Renseignez d'abord le téléphone du membre." };
  if (await db.user.findUnique({ where: { phone: m.phone } })) return { ok: false, message: "Ce téléphone est déjà utilisé par un compte." };
  const account = await db.user.create({
    data: { phone: m.phone, email: m.email, passwordHash: await unusablePassword(), profile: "ATHLETE", memberId: m.id },
  });
  await sendAccessLink(account.id, "INVITE", `Bonjour ${m.firstName}, votre accès athlète à l'application du club :`);
  await db.auditLog.create({ data: { userId: user.id, action: "member.account.create", entity: "Member", entityId: m.id } });
  revalidatePath(`/membres/${memberId}`);
  return { ok: true, message: `Compte créé, invitation envoyée au ${m.phone}.` };
}

/** Suppression logique : le membre est archivé, son historique est conservé (US-2.3). */
export async function archiveMember(id: string) {
  const user = await requirePermission("member.delete");
  await db.member.update({ where: { id }, data: { archived: true } });
  await db.auditLog.create({ data: { userId: user.id, action: "member.archive", entity: "Member", entityId: id } });
  revalidatePath("/membres");
  redirect("/membres");
}

/**
 * Suppression définitive (administrateur, US-2.3). Refusée si des paiements existent :
 * aucune donnée financière n'est jamais supprimée (§6 Fiabilité).
 */
export async function hardDeleteMember(id: string): Promise<{ ok: false; message: string } | void> {
  const user = await requirePermission("member.hardDelete");
  const m = await db.member.findUnique({ where: { id }, include: { _count: { select: { payments: true } } } });
  if (!m) return { ok: false, message: "Membre introuvable." };
  if (m._count.payments > 0) return { ok: false, message: "Des paiements existent : archivez le membre au lieu de le supprimer." };
  await db.$transaction([
    db.attendance.deleteMany({ where: { memberId: id } }),
    db.eventRegistration.deleteMany({ where: { memberId: id } }),
    db.due.deleteMany({ where: { memberId: id, amountPaid: 0 } }),
    db.parentLink.deleteMany({ where: { memberId: id } }),
    db.gradePassage.deleteMany({ where: { memberId: id } }),
    db.weighIn.deleteMany({ where: { memberId: id } }),
    db.examCandidate.deleteMany({ where: { memberId: id } }),
    db.result.deleteMany({ where: { memberId: id } }),
    db.user.updateMany({ where: { memberId: id }, data: { memberId: null, active: false } }),
    db.member.delete({ where: { id } }),
    db.auditLog.create({ data: { userId: user.id, action: "member.hardDelete", entity: "Member", entityId: id, details: `${fullName(m)} (${m.matricule})` } }),
  ]);
  revalidatePath("/membres");
  redirect("/membres");
}

/** Régénère le QR code : l'ancien devient invalide (US-9.2). */
export async function regenerateQr(id: string) {
  const user = await requirePermission("member.edit");
  await db.member.update({ where: { id }, data: { qrToken: newQrToken() } });
  await db.auditLog.create({ data: { userId: user.id, action: "member.qr.regenerate", entity: "Member", entityId: id } });
  revalidatePath(`/membres/${id}`);
}
