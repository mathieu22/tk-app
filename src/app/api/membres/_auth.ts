// Contrôle d'accès pour les routes API du module Membres.
// Les routes /api/* ne passent pas par le proxy (redirection) : on vérifie ici et on renvoie
// une réponse JSON 401/403 plutôt que d'appeler requirePermission (qui redirige, utile aux pages).
import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import type { Permission } from "@/lib/permissions";

export async function requireApiPermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) } as const;
  if (!user.perms.includes(permission)) {
    return { user: null, error: NextResponse.json({ error: "Accès refusé." }, { status: 403 }) } as const;
  }
  return { user, error: null } as const;
}
