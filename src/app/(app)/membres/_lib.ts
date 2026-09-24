// Helpers serveur du module Membres (dossier privé, non routé).
import "server-only";
import { db } from "@/lib/db";
import { schoolMonths } from "@/lib/format";

/** Date locale AAAA-MM-JJ (toISOString décalerait d'un jour à l'heure de Madagascar). */
export function isoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Cotisation à jour (US-2.1) : Droit + Passport de l'année et Écolage jusqu'au mois courant payés.
 * Les échéances doivent exister (appeler ensureDues avant). Membre sans échéance → à jour (rien de dû).
 */
export async function feesUpToDate(memberIds: string[], schoolYear: string, startMonth = 9) {
  const months = schoolMonths(startMonth);
  const now = new Date();
  const startYear = Number(schoolYear.slice(0, 4));
  // Mois écoulés de l'année scolaire (tous si l'année est passée, aucun si future)
  const idx = (now.getFullYear() - startYear) * 12 + now.getMonth() + 1 - startMonth;
  const elapsed = new Set(months.slice(0, Math.max(0, Math.min(12, idx + 1))));
  const dues = await db.due.findMany({
    where: { memberId: { in: memberIds }, schoolYear, eventKey: "", status: { not: "PAID" }, feeType: { code: { in: ["DROIT", "PASSPORT", "ECOLAGE"] } } },
    select: { memberId: true, month: true, feeType: { select: { code: true } } },
  });
  const late = new Set(dues.filter((d) => d.feeType.code !== "ECOLAGE" || elapsed.has(d.month)).map((d) => d.memberId));
  return new Map(memberIds.map((id) => [id, !late.has(id)]));
}

export async function nextMatricule() {
  const last = await db.member.findFirst({ where: { matricule: { startsWith: "ATH-" } }, orderBy: { matricule: "desc" }, select: { matricule: true } });
  const n = last ? Number(last.matricule.slice(4)) + 1 : 1;
  return `ATH-${String(Number.isFinite(n) ? n : 1).padStart(4, "0")}`;
}

/** Options de grade du formulaire, groupées par grille. */
export async function gradeOptions() {
  const grades = await db.grade.findMany({ where: { active: true }, include: { grid: true }, orderBy: [{ grid: { name: "asc" } }, { order: "asc" }] });
  return grades.map((g) => ({
    id: g.id,
    grid: g.grid.name,
    label: `${g.number === 1 ? "1er" : `${g.number}e`} ${g.kind.toLowerCase()} — ${g.beltLabel}`,
  }));
}
