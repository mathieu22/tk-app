// Export complet Excel (US-8.5) — réservé aux Réglages.
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { xlsxResponse } from "@/lib/export";
import { buildFullExport, exportFilename } from "./workbook";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Non authentifié", { status: 401 });
  if (!user.perms.includes("settings")) return new Response("Accès refusé", { status: 403 });
  const filename = exportFilename();
  await db.auditLog.create({ data: { userId: user.id, action: "export.full", entity: "Association", details: filename } });
  return xlsxResponse(filename, await buildFullExport());
}
