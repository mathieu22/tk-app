// Grades taekwondo (EPIC 4) : grade actuel, grille applicable, éligibilité au grade suivant.
import "server-only";
import { randomInt } from "node:crypto";
import { ageAt } from "./categories";
import { db } from "./db";

export const ADULT_AGE = 16; // grille Adulte à partir de 16 ans

/** Grille applicable à une date (âge à la date de l'examen). */
export const gridNameFor = (birthDate: Date, at = new Date()) => (ageAt(birthDate, at) >= ADULT_AGE ? "Adulte" : "Enfant");

/** Libellé court : « 12e keup », « 1er keup », « 2e dan ». */
export function gradeShortLabel(g: { kind: string; number: number }) {
  const n = g.number === 1 ? "1er" : `${g.number}e`;
  return `${n} ${g.kind.toLowerCase()}`;
}

/** Dernier passage de grade (grade actuel) de chaque membre demandé. */
export async function currentGrades(memberIds: string[]) {
  const passages = await db.gradePassage.findMany({
    where: { memberId: { in: memberIds } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { grade: { include: { grid: true } } },
  });
  const map = new Map<string, (typeof passages)[number]>();
  for (const p of passages) if (!map.has(p.memberId)) map.set(p.memberId, p);
  return map;
}

/** Grade suivant dans la grille (ordre croissant = progression) ; null après le 1er keup. */
export async function nextGrade(gradeId: string) {
  const g = await db.grade.findUniqueOrThrow({ where: { id: gradeId } });
  return db.grade.findFirst({ where: { gridId: g.gridId, active: true, order: { gt: g.order } }, orderBy: { order: "asc" } });
}

export function monthsBetween(from: Date, to: Date) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) - (to.getDate() < from.getDate() ? 1 : 0);
}

/**
 * Éligibilité (US-4.4) : durée de pratique dans le grade actuel (minMonths, 6 par défaut),
 * âge minimum et taux de présence minimum du grade visé.
 */
export function eligibility(opts: {
  currentSince: Date | null; currentMinMonths: number; birthDate: Date;
  target: { minAge: number | null; minAttendance: number | null } | null; attendancePct: number | null; at?: Date;
}) {
  const at = opts.at ?? new Date();
  const reasons: string[] = [];
  let monthsLeft = 0;
  if (opts.currentSince) {
    monthsLeft = Math.max(0, opts.currentMinMonths - monthsBetween(opts.currentSince, at));
    if (monthsLeft > 0) reasons.push(`Éligible dans ${monthsLeft} mois`);
  }
  if (opts.target?.minAge && ageAt(opts.birthDate, at) < opts.target.minAge) reasons.push(`Âge minimum ${opts.target.minAge} ans`);
  if (opts.target?.minAttendance && (opts.attendancePct ?? 0) < opts.target.minAttendance) {
    reasons.push(`Présence minimum ${opts.target.minAttendance} %`);
  }
  return { eligible: reasons.length === 0, monthsLeft, reasons };
}

/** Tirage au sort de poomsae (2e keup : 2 au choix ; 1er keup : 1 parmi tous jusqu'au Koryo). */
export const POOMSAE_UP_TO_KORYO = [
  "Taegeuk Il Jang", "Taegeuk Yi Jang", "Taegeuk Sam Jang", "Taegeuk Sah Jang",
  "Taegeuk Oh Jang", "Taegeuk Yuk Jang", "Taegeuk Tchil Jang", "Taegeuk Pal Jang", "Koryo",
];
export function drawPoomsae(count: number, pool = POOMSAE_UP_TO_KORYO.filter((p) => p !== "Taegeuk Pal Jang")) {
  const copy = [...pool];
  const out: string[] = [];
  while (out.length < count && copy.length) out.push(copy.splice(randomInt(copy.length), 1)[0]);
  return out;
}
