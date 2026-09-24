// Sauvegarde quotidienne (US-8.5), déclenchée par Vercel Cron (voir vercel.json).
// Vercel envoie « Authorization: Bearer $CRON_SECRET » ; sans CRON_SECRET, la route est désactivée.
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { xlsxResponse } from "@/lib/export";
import { buildFullExport, exportFilename } from "../../reglages/export/workbook";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response("Non autorisé", { status: 401 });
  const sheets = await buildFullExport();
  const filename = exportFilename();
  const rows = sheets.reduce((n, s) => n + s.rows.length, 0);
  // Pas de stockage externe configuré : le fichier est renvoyé à l'appelant et l'exécution journalisée.
  // Pour conserver les sauvegardes, brancher un stockage (Supabase Storage, S3…) ici.
  await db.auditLog.create({ data: { action: "backup.run", entity: "Association", details: `${filename} — ${rows} lignes` } });
  return xlsxResponse(filename, sheets);
}
