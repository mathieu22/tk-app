// Catégories d'âge et de poids de la Fédération Malagasy de Taekwondo (US-5.5, annexe B).
// Fonctions pures + chargement du référentiel d'une saison.
import "server-only";
import { db } from "./db";

/** Âge fédéral = année de la saison − année de naissance (et non l'âge exact). */
export const federalAge = (birthDate: Date, seasonYear: number) => seasonYear - birthDate.getFullYear();

/** Âge exact à une date (grilles de grades, statut mineur). */
export function ageAt(birthDate: Date, at = new Date()) {
  let a = at.getFullYear() - birthDate.getFullYear();
  const m = at.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birthDate.getDate())) a--;
  return a;
}
export const isMinor = (birthDate: Date) => ageAt(birthDate) < 18;

type AgeCat = { id: string; name: string; ageMin: number; ageMax: number | null; order: number };
type WeightCat = { id: string; sex: string; label: string; maxKg: number | null; order: number };

export function ageCategoryFor<T extends AgeCat>(categories: T[], age: number): T | null {
  return categories.find((c) => age >= c.ageMin && (c.ageMax === null || age <= c.ageMax)) ?? null;
}

/**
 * Plus petite catégorie dont la limite est ≥ au poids ; au-delà, la catégorie « + » (maxKg null).
 * Retourne aussi une alerte si le poids est à moins de `alertKg` d'une limite.
 */
export function weightCategoryFor<T extends WeightCat>(weights: T[], sex: string, kg: number, alertKg = 1) {
  const list = weights.filter((w) => w.sex === sex).sort((a, b) => a.order - b.order);
  const bounded = list.filter((w) => w.maxKg !== null);
  const category = bounded.find((w) => kg <= (w.maxKg as number)) ?? list.find((w) => w.maxKg === null) ?? null;
  const nearLimit = bounded.some((w) => Math.abs((w.maxKg as number) - kg) < alertKg);
  return { category, nearLimit };
}

export async function getSeason(year = new Date().getFullYear()) {
  return db.season.findUnique({
    where: { year },
    include: { ageCategories: { orderBy: { order: "asc" }, include: { weights: { orderBy: { order: "asc" } } } }, allowedPoomsae: true },
  });
}
export type SeasonWithCategories = NonNullable<Awaited<ReturnType<typeof getSeason>>>;

/** Profil compétition d'un athlète pour une saison : catégorie d'âge, de poids, poomsae autorisés, alertes. */
export function competitionProfile(
  season: SeasonWithCategories,
  athlete: { birthDate: Date; sex: string },
  lastWeighIn: { weightKg: number; date: Date } | null,
  opts: { alertKg?: number; maxDays?: number; at?: Date } = {},
) {
  const age = federalAge(athlete.birthDate, season.year);
  const ageCategory = ageCategoryFor(season.ageCategories, age);
  const weight = ageCategory && lastWeighIn
    ? weightCategoryFor(ageCategory.weights, athlete.sex, lastWeighIn.weightKg, opts.alertKg ?? 1)
    : null;
  const at = opts.at ?? new Date();
  const staleWeighIn = !lastWeighIn || (at.getTime() - lastWeighIn.date.getTime()) / 86400e3 > (opts.maxDays ?? 30);
  const poomsae = season.allowedPoomsae.find((p) => age >= p.ageMin && (p.ageMax === null || age <= p.ageMax)) ?? null;
  return {
    age,
    ageCategory: ageCategory?.name ?? null,
    weightCategory: weight?.category?.label ?? null,
    nearLimit: weight?.nearLimit ?? false,
    staleWeighIn,
    poomsae: poomsae ? { label: poomsae.label, list: poomsae.poomsae.split(",").map((s) => s.trim()) } : null,
  };
}
