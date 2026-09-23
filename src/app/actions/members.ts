"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { BLOOD_GROUPS, BOARD_POSITIONS, MEMBER_STATUSES, POSITIONS, type Position } from "@/lib/domain";
import { normalizePhone } from "@/lib/format";
import { newQrToken } from "@/lib/qr";

export type MemberFormState =
  | { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | undefined;

const optional = z.string().trim().transform((v) => v || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide").transform((v) => new Date(`${v}T00:00:00`));

const schema = z.object({
  id: z.string().optional(),
  lastName: z.string().trim().min(1, "Nom obligatoire").transform((v) => v.toUpperCase()),
  firstName: z
    .string()
    .trim()
    .min(1, "Prénom obligatoire")
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
});

function ageAt(birth: Date, at = new Date()) {
  let age = at.getFullYear() - birth.getFullYear();
  const m = at.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birth.getDate())) age--;
  return age;
}

async function nextMatricule() {
  const last = await db.member.findFirst({ where: { matricule: { startsWith: "ATH-" } }, orderBy: { matricule: "desc" }, select: { matricule: true } });
  const n = last ? Number(last.matricule.slice(4)) + 1 : 1;
  return `ATH-${String(n).padStart(4, "0")}`;
}

export async function saveMember(_: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const user = await requirePermission("member.edit");
  const raw = Object.fromEntries([...formData].filter(([k, v]) => !k.startsWith("$") && typeof v === "string")) as Record<string, string>;
  // Les valeurs saisies sont renvoyées pour que React ne vide pas le formulaire en cas d'erreur.
  const fail = (state: Omit<NonNullable<MemberFormState>, "values">): MemberFormState => ({ ...state, values: raw });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return fail({ error: "Vérifiez les champs signalés.", fieldErrors });
  }
  const { id, phone: rawPhone, ...data } = parsed.data;

  // Téléphone : obligatoire sauf pour un mineur (contact via ses tuteurs).
  let phone: string | null = null;
  if (rawPhone) {
    phone = normalizePhone(rawPhone);
    if (!phone) return fail({ fieldErrors: { phone: "Numéro invalide (ex. +261 34 12 345 67)" } });
  } else if (ageAt(data.birthDate) >= 18) {
    return fail({ fieldErrors: { phone: "Téléphone obligatoire pour un majeur" } });
  }
  // TODO tuteurs (TUTEUR1 obligatoire pour un mineur) — EPIC 7.

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

  const values = { ...data, phone };
  let memberId = id;
  if (id) {
    await db.member.update({ where: { id }, data: values });
    await db.auditLog.create({ data: { userId: user.id, action: "member.update", entity: "Member", entityId: id } });
  } else {
    const created = await db.member.create({ data: { ...values, matricule: await nextMatricule(), qrToken: newQrToken() } });
    memberId = created.id;
    await db.auditLog.create({ data: { userId: user.id, action: "member.create", entity: "Member", entityId: created.id } });
  }

  revalidatePath("/membres");
  redirect(`/membres/${memberId}`);
}

/** Suppression logique : le membre est archivé, son historique est conservé (US-2.3). */
export async function archiveMember(id: string) {
  const user = await requirePermission("member.delete");
  await db.member.update({ where: { id }, data: { archived: true } });
  await db.auditLog.create({ data: { userId: user.id, action: "member.archive", entity: "Member", entityId: id } });
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
