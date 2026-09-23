// Tuteurs / comptes parents (US-2.5 règles TUTEUR1/2, US-7.1).
import "server-only";
import { db } from "./db";
import { normalizePhone } from "./format";

export const RELATIONSHIPS = { FATHER: "Père", MOTHER: "Mère", LEGAL_GUARDIAN: "Tuteur légal", OTHER: "Autre" } as const;
export type Relationship = keyof typeof RELATIONSHIPS;

export type ParentInput = { lastName: string; firstName: string; phone: string; email?: string | null };

/**
 * Cherche un parent existant par téléphone (un seul compte par parent, même avec plusieurs
 * enfants au club), sinon le crée. Le téléphone doit être valide (+261…).
 */
export async function findOrCreateParent(input: ParentInput) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error("Téléphone du tuteur invalide.");
  const existing = await db.parent.findUnique({ where: { phone } });
  if (existing) return existing;
  return db.parent.create({
    data: {
      lastName: input.lastName.trim().toUpperCase(),
      firstName: input.firstName.trim(),
      phone,
      email: input.email?.trim() || null,
    },
  });
}

/** Associe (ou met à jour) un tuteur : rank 1 = TUTEUR1 contact principal, 2 = TUTEUR2. Journalisé. */
export async function linkParent(memberId: string, parentId: string, relationship: Relationship, rank: 1 | 2, userId?: string) {
  // Un seul tuteur par rang
  await db.parentLink.deleteMany({ where: { memberId, rank, NOT: { parentId } } });
  await db.parentLink.upsert({
    where: { parentId_memberId: { parentId, memberId } },
    create: { parentId, memberId, relationship, rank },
    update: { relationship, rank },
  });
  await db.auditLog.create({ data: { userId, action: "parent.link", entity: "Member", entityId: memberId, details: `${parentId} rang ${rank}` } });
}

export async function unlinkParent(memberId: string, parentId: string, userId?: string) {
  await db.parentLink.deleteMany({ where: { memberId, parentId } });
  await db.auditLog.create({ data: { userId, action: "parent.unlink", entity: "Member", entityId: memberId, details: parentId } });
}

/** Recherche de parents existants (autocomplétion du formulaire membre). */
export async function searchParents(q: string) {
  const t = q.trim();
  if (t.length < 2) return [];
  const phone = normalizePhone(t);
  return db.parent.findMany({
    where: phone ? { phone } : { OR: [{ lastName: { contains: t.toUpperCase() } }, { firstName: { contains: t } }] },
    take: 8,
    orderBy: { lastName: "asc" },
  });
}
