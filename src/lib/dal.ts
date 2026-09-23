// Couche d'accès sécurisée : toute page / action serveur passe par ici
// (le proxy ne fait qu'une redirection optimiste).
import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { isStaff, permissionsFor, type Permission } from "./permissions";
import { readSession } from "./session";

export const getAssociation = cache(async () => {
  const a = await db.association.findFirst();
  if (!a) throw new Error("Association non initialisée — lancer `npm run db:seed`");
  return a;
});

export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, phone: true, email: true, profile: true, active: true, memberId: true, parent: { select: { id: true } } },
  });
  if (!user?.active) return null;
  const association = await getAssociation();
  return { ...user, parentId: user.parent?.id ?? null, perms: permissionsFor(user.profile, association.permissions) };
});
export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

export async function requireStaff() {
  const user = await requireUser();
  if (!isStaff(user.profile)) redirect("/mon-espace");
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!user.perms.includes(permission)) redirect("/acces-refuse");
  return user;
}

/** Page d'accueil selon le profil : staff → Présence, athlète / parent → Mon espace. */
export function homeFor(profile: string) {
  return isStaff(profile) ? "/presence" : "/mon-espace";
}

/**
 * Membres visibles par l'utilisateur (US-7.2, US-9.3) : tous pour le staff autorisé,
 * soi-même pour un athlète, ses enfants pour un parent.
 */
export async function visibleMemberIds(user: CurrentUser): Promise<string[] | "ALL"> {
  if (user.perms.includes("member.view")) return "ALL";
  if (user.profile === "PARENT" && user.parentId) {
    const links = await db.parentLink.findMany({ where: { parentId: user.parentId }, select: { memberId: true } });
    return links.map((l) => l.memberId);
  }
  return user.memberId ? [user.memberId] : [];
}

export async function requireMemberAccess(memberId: string) {
  const user = await requireUser();
  const ids = await visibleMemberIds(user);
  if (ids !== "ALL" && !ids.includes(memberId)) redirect("/acces-refuse");
  return user;
}
