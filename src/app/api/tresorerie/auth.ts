// Contrôle d'accès des exports (les routes /api ne passent pas par le proxy).
import "server-only";
import { getCurrentUser } from "@/lib/dal";

export async function treasuryReader() {
  const user = await getCurrentUser();
  if (!user) return { error: new Response("Non authentifié", { status: 401 }) };
  if (!user.perms.includes("treasury.view")) return { error: new Response("Accès refusé", { status: 403 }) };
  return { user };
}
