// Données du module Grades : grade actuel, éligibilité, présence, cotisations (US-4.2, 4.4, 4.5).
import "server-only";
import { ageAt } from "@/lib/categories";
import { db } from "@/lib/db";
import { schoolMonths } from "@/lib/format";
import { currentGrades, eligibility, gradeShortLabel, gridNameFor } from "@/lib/grades";

export const EXAM_TESTS = {
  poomsae: "Poomsae",
  kibon: "Kibon",
  kyorugi: "Kyorugi",
  kyukpa: "Kyukpa",
  theorie: "Théorie",
} as const;
export type ExamTest = keyof typeof EXAM_TESTS;

export const MENTIONS = ["Passable", "Assez bien", "Bien", "Très bien", "Excellent"];

/** Taux de présence aux séances des 12 derniers mois (entraînements uniquement, US-1.11). */
export async function attendancePcts(members: { id: string; groupId: string | null; joinedAt: Date }[]) {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const [sessions, presences] = await Promise.all([
    db.session.findMany({ where: { date: { gte: since } }, select: { id: true, date: true, groupId: true } }),
    db.attendance.groupBy({
      by: ["memberId"],
      where: { memberId: { in: members.map((m) => m.id) }, sessionId: { not: null }, status: "PRESENT", session: { date: { gte: since } } },
      _count: true,
    }),
  ]);
  const map = new Map<string, number | null>();
  for (const m of members) {
    const expected = sessions.filter((s) => s.date >= m.joinedAt && (!s.groupId || s.groupId === m.groupId)).length;
    const present = presences.find((p) => p.memberId === m.id)?._count ?? 0;
    map.set(m.id, expected ? Math.min(100, Math.round((present / expected) * 100)) : null);
  }
  return map;
}

/** Cotisations à jour : Droit, Passport et Écolage échus (jusqu'au mois en cours) tous payés. */
export async function duesUpToDate(memberIds: string[], schoolYear: string, startMonth = 9) {
  const order = schoolMonths(startMonth);
  const currentIdx = order.indexOf(new Date().getMonth() + 1);
  const unpaid = await db.due.findMany({
    where: { memberId: { in: memberIds }, schoolYear, eventKey: "", status: { not: "PAID" } },
    select: { memberId: true, month: true },
  });
  const late = new Set(unpaid.filter((d) => d.month === 0 || order.indexOf(d.month) <= currentIdx).map((d) => d.memberId));
  return new Map(memberIds.map((id) => [id, !late.has(id)]));
}

type MemberLite = { id: string; birthDate: Date; groupId: string | null; joinedAt: Date };

/**
 * Synthèse par membre : grade actuel, grille applicable, grade suivant proposé, éligibilité.
 * Le grade suivant est pris dans la grille applicable aujourd'hui (à 16 ans : correspondance Enfant → Adulte).
 */
export async function gradeSummaries(members: MemberLite[]) {
  const ids = members.map((m) => m.id);
  const [current, grids, mappings, pcts] = await Promise.all([
    currentGrades(ids),
    db.gradeGrid.findMany({ include: { grades: { where: { active: true }, orderBy: { order: "asc" } } } }),
    db.gradeMapping.findMany(),
    attendancePcts(members),
  ]);
  const byName = new Map(grids.map((g) => [g.name, g]));
  const mapChildToAdult = new Map(mappings.map((m) => [m.childGradeId, m.adultGradeId]));

  return new Map(
    members.map((m) => {
      const passage = current.get(m.id) ?? null;
      const gridName = gridNameFor(m.birthDate);
      const grid = byName.get(gridName) ?? grids[0];
      let reference = passage?.grade ?? null;
      let adultEquivalent: string | null = null;
      // Passage de la grille Enfant à la grille Adulte (US-4 règles de gestion)
      if (reference && gridName === "Adulte" && reference.grid.name === "Enfant") {
        const adultId = mapChildToAdult.get(reference.id);
        const adult = grid?.grades.find((g) => g.id === adultId) ?? null;
        if (adult) {
          adultEquivalent = adult.id;
          reference = { ...adult, grid: grid! };
        }
      }
      const next = grid
        ? reference
          ? reference.kind === "KEUP" && reference.gridId === grid.id
            ? grid.grades.find((g) => g.order > reference!.order) ?? null
            : null
          : grid.grades[0] ?? null
        : null;
      const elig = eligibility({
        currentSince: passage?.date ?? null,
        currentMinMonths: passage?.grade.minMonths ?? 0,
        birthDate: m.birthDate,
        target: next,
        attendancePct: pcts.get(m.id) ?? null,
      });
      return [m.id, { passage, gridName, next, adultEquivalent, attendancePct: pcts.get(m.id) ?? null, ...elig }];
    }),
  );
}

export function gradeTitle(g: { kind: string; number: number; beltLabel: string }) {
  return `${g.beltLabel} · ${gradeShortLabel(g)}`;
}

/** Signalement poom → dan (US-4 règles) : poom et âge ≥ seuil de conversion. */
export function poomToDanDue(grade: { kind: string } | null | undefined, birthDate: Date, threshold: number) {
  return grade?.kind === "POOM" && ageAt(birthDate) >= threshold;
}
