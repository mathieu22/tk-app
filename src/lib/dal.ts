// Couche d'accès sécurisée : toute page / action serveur passe par ici
// (le proxy ne fait qu'une redirection optimiste).
import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { can, type Permission } from "./permissions";
import { readSession } from "./session";

export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, phone: true, profile: true, active: true, memberId: true },
  });
  return user?.active ? user : null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.profile, permission)) redirect("/acces-refuse");
  return user;
}

export const getAssociation = cache(async () => {
  const a = await db.association.findFirst();
  if (!a) throw new Error("Association non initialisée — lancer `npm run db:seed`");
  return a;
});
