"use server";
// Actions du module Palmarès (EPIC 5).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { notifyMember } from "@/lib/notify";
import { DISCIPLINES, LEVELS, MEDALS, OUTCOMES } from "@/app/(app)/palmares/data";

export type FormState = { error?: string; errors?: Record<string, string>; ok?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const optInt = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).max(999).nullable());

function zodErrors(err: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const i of err.issues) errors[String(i.path[0])] ??= i.message;
  return { errors, error: "Vérifiez les champs signalés." };
}

async function audit(userId: string, action: string, entity: string, entityId: string, details?: string) {
  await db.auditLog.create({ data: { userId, action, entity, entityId, details } });
}

// ─── Compétitions (US-5.1) ───

const competitionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Nom obligatoire.").max(160),
  startDate: dateStr,
  endDate: dateStr,
  location: z.string().trim().max(160),
  level: z.enum(Object.keys(LEVELS) as [keyof typeof LEVELS, ...(keyof typeof LEVELS)[]]),
  kind: z.enum(["INDIVIDUAL", "TEAM"]),
  organizer: z.string().trim().max(160),
  posterUrl: z.string().max(2_000_000, "Image trop lourde.").refine((v) => v === "" || v.startsWith("data:image/"), "Image invalide."),
  seasonId: z.string(),
});

/** Crée (ou modifie) une compétition ; crée / relie un événement de type « Compétition » (EPIC 1). */
export async function saveCompetition(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("palmares.manage");
  const raw = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  const p = competitionSchema.safeParse({ ...raw, id: raw.id || undefined, seasonId: raw.seasonId || "" });
  if (!p.success) return zodErrors(p.error);
  const d = p.data;
  const start = new Date(`${d.startDate}T00:00:00`);
  const end = new Date(`${d.endDate}T00:00:00`);
  if (end < start) return { errors: { endDate: "La date de fin doit suivre le début." } };

  if (d.id) {
    const existing = await db.competition.findUniqueOrThrow({ where: { id: d.id } });
    await db.competition.update({
      where: { id: d.id },
      data: {
        name: d.name, startDate: start, endDate: end, location: d.location || null, level: d.level, kind: d.kind,
        organizer: d.organizer || null, posterUrl: d.posterUrl || null, seasonId: d.seasonId || null,
      },
    });
    if (existing.eventId) {
      await db.event.update({ where: { id: existing.eventId }, data: { title: d.name, startDate: start, endDate: end, location: d.location || null } });
    }
    await audit(user.id, "competition.update", "Competition", d.id, d.name);
    revalidatePath(`/palmares/competitions/${d.id}`);
    return { ok: "Compétition mise à jour." };
  }

  const type = await db.eventType.findFirst({ where: { label: "Compétition" } });
  const competition = await db.$transaction(async (tx) => {
    const event = type
      ? await tx.event.create({
          data: {
            title: d.name, typeId: type.id, startDate: start, endDate: end, location: d.location || null,
            audience: "SELECTION", participationMode: "SUMMONS", createdById: user.id,
            days: { create: { date: start } },
          },
        })
      : null;
    return tx.competition.create({
      data: {
        name: d.name, startDate: start, endDate: end, location: d.location || null, level: d.level, kind: d.kind,
        organizer: d.organizer || null, posterUrl: d.posterUrl || null, seasonId: d.seasonId || null, eventId: event?.id,
      },
    });
  });
  await audit(user.id, "competition.create", "Competition", competition.id, competition.name);
  revalidatePath("/palmares");
  redirect(`/palmares/competitions/${competition.id}`);
}

export async function deleteCompetition(id: string) {
  const user = await requirePermission("palmares.manage");
  const c = await db.competition.findUniqueOrThrow({ where: { id } });
  await db.competition.delete({ where: { id } });
  await audit(user.id, "competition.delete", "Competition", id, c.name);
  revalidatePath("/palmares");
  redirect("/palmares");
}

/** Convoque des athlètes à la compétition (sélection → événement lié). */
export async function addParticipants(competitionId: string, memberIds: string[]) {
  await requirePermission("palmares.manage");
  const c = await db.competition.findUniqueOrThrow({ where: { id: competitionId } });
  if (c.eventId) {
    for (const memberId of memberIds) {
      await db.eventRegistration.upsert({
        where: { eventId_memberId: { eventId: c.eventId, memberId } },
        create: { eventId: c.eventId, memberId, response: "YES" },
        update: {},
      });
    }
  }
  revalidatePath(`/palmares/competitions/${competitionId}`);
}

// ─── Résultats (US-5.2) ───

const resultSchema = z.object({
  memberId: z.string().min(1),
  discipline: z.enum(Object.keys(DISCIPLINES) as [keyof typeof DISCIPLINES, ...(keyof typeof DISCIPLINES)[]]),
  ageCategory: z.string().trim().max(40),
  sex: z.enum(["M", "F"]),
  weightCategory: z.string().trim().max(20),
  weighInKg: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).max(300).nullable()),
  outcome: z.enum(Object.keys(OUTCOMES) as [keyof typeof OUTCOMES, ...(keyof typeof OUTCOMES)[]]),
  rank: optInt,
  score: z.string().trim().max(30),
  observation: z.string().trim().max(1000),
  teamName: z.string().trim().max(120),
  photoUrl: z.string().max(2_000_000, "Image trop lourde.").refine((v) => v === "" || v.startsWith("data:image/"), "Image invalide."),
});

/** Saisie en lot (US-5.2) : un enregistrement par ligne postée `results[i].champ`. */
export async function saveResults(competitionId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("palmares.manage");
  const competition = await db.competition.findUniqueOrThrow({ where: { id: competitionId } });
  const indices = new Set([...fd.keys()].map((k) => k.match(/^results\[(\d+)\]/)?.[1]).filter((x): x is string => !!x));
  let saved = 0;
  const errors: Record<string, string> = {};
  for (const i of indices) {
    const get = (k: string) => str(fd, `results[${i}].${k}`);
    if (!get("memberId")) continue; // ligne vide
    const detailsRaw = get("details");
    const parsed = resultSchema.safeParse({
      memberId: get("memberId"), discipline: get("discipline"), ageCategory: get("ageCategory"), sex: get("sex"),
      weightCategory: get("weightCategory"), weighInKg: get("weighInKg"), outcome: get("outcome"), rank: get("rank"),
      score: get("score"), observation: get("observation"), teamName: get("teamName"), photoUrl: get("photoUrl"),
    });
    if (!parsed.success) {
      errors[`results[${i}]`] = parsed.error.issues[0]?.message ?? "Ligne invalide.";
      continue;
    }
    const d = parsed.data;
    let details = "[]";
    try {
      const arr = JSON.parse(detailsRaw || "[]");
      if (Array.isArray(arr)) details = JSON.stringify(arr.slice(0, 20));
    } catch { /* garde [] */ }
    const result = await db.result.create({
      data: {
        competitionId, memberId: d.memberId, discipline: d.discipline, ageCategory: d.ageCategory || null, sex: d.sex,
        weightCategory: d.weightCategory || null, weighInKg: d.weighInKg, outcome: d.outcome, rank: d.rank,
        score: d.score || null, observation: d.observation || null, teamName: d.teamName || null, photoUrl: d.photoUrl || null, details,
      },
      include: { member: true },
    });
    if (MEDALS.includes(d.outcome as (typeof MEDALS)[number]) || d.outcome === "RANK") {
      await notifyMember(
        d.memberId, "RESULT", "Nouveau résultat",
        `${fullName(result.member)} — ${competition.name} : ${OUTCOMES[d.outcome].label}${d.rank ? ` (${d.rank}e)` : ""}.`,
        `/palmares/athletes/${d.memberId}`,
      );
    }
    saved++;
  }
  await audit(user.id, "result.create", "Competition", competitionId, `${saved} résultat(s)`);
  revalidatePath(`/palmares/competitions/${competitionId}`);
  revalidatePath("/palmares");
  if (Object.keys(errors).length) return { errors, error: "Certaines lignes n'ont pas pu être enregistrées." };
  return { ok: `${saved} résultat(s) enregistré(s).` };
}

export async function deleteResult(id: string) {
  const user = await requirePermission("palmares.manage");
  const r = await db.result.delete({ where: { id } });
  await audit(user.id, "result.delete", "Result", id, r.memberId);
  revalidatePath(`/palmares/competitions/${r.competitionId}`);
  revalidatePath(`/palmares/athletes/${r.memberId}`);
}

// ─── Pesées (US-5.5) ───

const weighInSchema = z.object({ memberId: z.string().min(1), date: dateStr, weightKg: z.coerce.number().min(1, "Poids invalide.").max(300) });

export async function addWeighIn(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("palmares.manage");
  const p = weighInSchema.safeParse({ memberId: str(fd, "memberId"), date: str(fd, "date"), weightKg: str(fd, "weightKg") });
  if (!p.success) return zodErrors(p.error);
  const d = p.data;
  await db.weighIn.create({ data: { memberId: d.memberId, date: new Date(`${d.date}T12:00:00`), weightKg: d.weightKg, recordedById: user.id } });
  revalidatePath(`/palmares/athletes/${d.memberId}`);
  return { ok: "Pesée enregistrée." };
}

export async function deleteWeighIn(id: string) {
  await requirePermission("palmares.manage");
  const w = await db.weighIn.delete({ where: { id } });
  revalidatePath(`/palmares/athletes/${w.memberId}`);
}

// ─── Référentiel de saison (US-5.5) ───

const seasonSchema = z.object({ year: z.coerce.number().int().min(2000).max(2100), label: z.string().trim().min(1).max(60) });

export async function createSeason(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("palmares.manage");
  const p = seasonSchema.safeParse({ year: str(fd, "year"), label: str(fd, "label") });
  if (!p.success) return zodErrors(p.error);
  const exists = await db.season.findUnique({ where: { year: p.data.year } });
  if (exists) return { errors: { year: "Cette saison existe déjà." } };
  const season = await db.season.create({ data: p.data });
  await audit(user.id, "season.create", "Season", season.id, String(season.year));
  revalidatePath("/palmares/categories");
  redirect(`/palmares/categories?saison=${season.id}`);
}

/** Duplique une saison (catégories d'âge, de poids, poomsae autorisés) vers l'année suivante. */
export async function duplicateSeason(seasonId: string) {
  const user = await requirePermission("palmares.manage");
  const source = await db.season.findUniqueOrThrow({
    where: { id: seasonId }, include: { ageCategories: { include: { weights: true } }, allowedPoomsae: true },
  });
  const nextYear = source.year + 1;
  const existing = await db.season.findUnique({ where: { year: nextYear } });
  if (existing) throw new Error(`La saison ${nextYear} existe déjà.`);
  const created = await db.$transaction(async (tx) => {
    const season = await tx.season.create({ data: { year: nextYear, label: `Saison ${nextYear}` } });
    for (const ac of source.ageCategories) {
      const cat = await tx.ageCategory.create({ data: { seasonId: season.id, name: ac.name, ageMin: ac.ageMin, ageMax: ac.ageMax, order: ac.order } });
      if (ac.weights.length) {
        await tx.weightCategory.createMany({
          data: ac.weights.map((w) => ({ ageCategoryId: cat.id, sex: w.sex, label: w.label, maxKg: w.maxKg, order: w.order })),
        });
      }
    }
    if (source.allowedPoomsae.length) {
      await tx.allowedPoomsae.createMany({
        data: source.allowedPoomsae.map((p) => ({ seasonId: season.id, label: p.label, ageMin: p.ageMin, ageMax: p.ageMax, poomsae: p.poomsae })),
      });
    }
    return season;
  });
  await audit(user.id, "season.duplicate", "Season", created.id, `depuis ${source.year}`);
  revalidatePath("/palmares/categories");
  redirect(`/palmares/categories?saison=${created.id}`);
}

const ageCatSchema = z.object({
  id: z.string().optional(), seasonId: z.string().min(1), name: z.string().trim().min(1, "Nom obligatoire.").max(40),
  ageMin: z.coerce.number().int().min(0).max(99), ageMax: optInt,
});

export async function saveAgeCategory(_: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("palmares.manage");
  const raw = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  const p = ageCatSchema.safeParse({ ...raw, id: raw.id || undefined });
  if (!p.success) return zodErrors(p.error);
  const { id, ...data } = p.data;
  if (id) await db.ageCategory.update({ where: { id }, data });
  else {
    const last = await db.ageCategory.findFirst({ where: { seasonId: data.seasonId }, orderBy: { order: "desc" } });
    await db.ageCategory.create({ data: { ...data, order: (last?.order ?? -1) + 1 } });
  }
  revalidatePath("/palmares/categories");
  return { ok: "Catégorie enregistrée." };
}

export async function deleteAgeCategory(id: string) {
  await requirePermission("palmares.manage");
  await db.ageCategory.delete({ where: { id } });
  revalidatePath("/palmares/categories");
}

const weightCatSchema = z.object({
  id: z.string().optional(), ageCategoryId: z.string().min(1), sex: z.enum(["M", "F"]),
  label: z.string().trim().min(1, "Libellé obligatoire.").max(20), maxKg: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).max(300).nullable()),
});

export async function saveWeightCategory(_: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("palmares.manage");
  const raw = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  const p = weightCatSchema.safeParse({ ...raw, id: raw.id || undefined });
  if (!p.success) return zodErrors(p.error);
  const { id, ...data } = p.data;
  if (id) await db.weightCategory.update({ where: { id }, data });
  else {
    const last = await db.weightCategory.findFirst({ where: { ageCategoryId: data.ageCategoryId, sex: data.sex }, orderBy: { order: "desc" } });
    await db.weightCategory.create({ data: { ...data, order: (last?.order ?? -1) + 1 } });
  }
  revalidatePath("/palmares/categories");
  return { ok: "Catégorie de poids enregistrée." };
}

export async function deleteWeightCategory(id: string) {
  await requirePermission("palmares.manage");
  await db.weightCategory.delete({ where: { id } });
  revalidatePath("/palmares/categories");
}

const poomsaeSchema = z.object({
  id: z.string().optional(), seasonId: z.string().min(1), label: z.string().trim().min(1, "Nom obligatoire.").max(60),
  ageMin: z.coerce.number().int().min(0).max(99), ageMax: optInt, poomsae: z.string().trim().min(1, "Liste obligatoire.").max(400),
});

export async function saveAllowedPoomsae(_: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("palmares.manage");
  const raw = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  const p = poomsaeSchema.safeParse({ ...raw, id: raw.id || undefined });
  if (!p.success) return zodErrors(p.error);
  const { id, ...data } = p.data;
  if (id) await db.allowedPoomsae.update({ where: { id }, data });
  else await db.allowedPoomsae.create({ data });
  revalidatePath("/palmares/categories");
  return { ok: "Poomsae autorisés enregistrés." };
}

export async function deleteAllowedPoomsae(id: string) {
  await requirePermission("palmares.manage");
  await db.allowedPoomsae.delete({ where: { id } });
  revalidatePath("/palmares/categories");
}
