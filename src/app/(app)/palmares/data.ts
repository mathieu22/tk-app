// Données serveur du module Palmarès (EPIC 5) : accès base. Les libellés purs (utilisables
// côté client, ex. dans competition-form.tsx) sont dans ./labels pour ne pas entraîner `db`
// dans le bundle client.
import "server-only";
import { db } from "@/lib/db";

export * from "./labels";

/** Référentiel applicable à une compétition : sa saison, sinon celle de son année, sinon la plus récente antérieure. */
export async function seasonForCompetition(c: { seasonId: string | null; startDate: Date }) {
  const include = { ageCategories: { orderBy: { order: "asc" as const }, include: { weights: { orderBy: { order: "asc" as const } } } }, allowedPoomsae: true };
  if (c.seasonId) {
    const s = await db.season.findUnique({ where: { id: c.seasonId }, include });
    if (s) return s;
  }
  return db.season.findFirst({ where: { year: { lte: c.startDate.getFullYear() } }, orderBy: { year: "desc" }, include })
    ?? db.season.findFirst({ orderBy: { year: "desc" }, include });
}
