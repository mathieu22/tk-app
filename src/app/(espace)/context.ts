// Contexte de l'espace parent / athlète : enfants visibles et enfant sélectionné (US-7.2).
import "server-only";
import { db } from "@/lib/db";
import { requireUser, visibleMemberIds, type CurrentUser } from "@/lib/dal";

export type EspaceChild = { id: string; firstName: string; lastName: string; photoUrl: string | null };

/**
 * Enfants visibles : ceux du parent, l'athlète lui-même, ou (staff en prévisualisation)
 * les membres actifs. L'enfant demandé (`?enfant=`) n'est retenu que s'il est visible.
 */
export async function espaceContext(enfant: string | string[] | undefined) {
  const user = await requireUser();
  const ids = await visibleMemberIds(user);
  const select = { id: true, firstName: true, lastName: true, photoUrl: true } as const;
  const wanted = typeof enfant === "string" ? enfant : undefined;

  let children: EspaceChild[];
  if (ids === "ALL") {
    // Prévisualisation staff : sélecteur limité, mais tout membre accessible via ?enfant=
    children = await db.member.findMany({ where: { archived: false, status: "ACTIVE" }, select, orderBy: { lastName: "asc" }, take: 30 });
    if (wanted && !children.some((c) => c.id === wanted)) {
      const extra = await db.member.findUnique({ where: { id: wanted }, select });
      if (extra) children = [extra, ...children];
    }
  } else {
    children = await db.member.findMany({ where: { id: { in: ids }, archived: false }, select, orderBy: { firstName: "asc" } });
  }
  const selected = children.find((c) => c.id === wanted) ?? children[0] ?? null;
  return { user, children, selected, preview: ids === "ALL" };
}

/** Ids visibles sous forme de filtre Prisma (`memberId in …`, ou pas de filtre pour le staff). */
export async function memberFilter(user: CurrentUser) {
  const ids = await visibleMemberIds(user);
  return ids === "ALL" ? {} : { memberId: { in: ids } };
}

export const withChild = (href: string, childId?: string | null) =>
  childId ? `${href}${href.includes("?") ? "&" : "?"}enfant=${childId}` : href;

type AudienceMember = { id: string; groupId: string | null; position: string };
const BOARD = ["PRESIDENT", "VICE_PRESIDENT", "SECRETARY", "TREASURER"];

/**
 * Événements (non annulés) entre deux dates qui concernent un membre (public ciblé ou inscription),
 * avec sa réponse éventuelle.
 */
export async function relevantEvents(member: AudienceMember, from: Date, to?: Date) {
  const events = await db.event.findMany({
    where: { cancelled: false, endDate: { gte: from }, ...(to ? { startDate: { lt: to } } : {}) },
    include: { type: true, registrations: { where: { memberId: member.id } }, days: { orderBy: { date: "asc" } } },
    orderBy: { startDate: "asc" },
    take: 100,
  });
  return events.filter((e) => {
    if (e.registrations.length) return true;
    if (e.audience === "ALL" || e.audience === "PARENTS") return true;
    if (e.audience === "BOARD") return BOARD.includes(member.position);
    if (e.audience === "GROUPS") {
      try { return !!member.groupId && (JSON.parse(e.audienceGroupIds || "[]") as string[]).includes(member.groupId); } catch { return false; }
    }
    return false; // SELECTION sans inscription
  });
}

/** Séances du groupe du membre (ou ouvertes à tous) entre deux dates. */
export function memberSessionsWhere(groupId: string | null, from: Date, to?: Date) {
  return { date: { gte: from, ...(to ? { lt: to } : {}) }, OR: [{ groupId: null }, ...(groupId ? [{ groupId }] : [])] };
}
