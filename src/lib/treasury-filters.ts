// Filtres du journal (US-6.6), partagés entre la page et l'export Excel.
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { MONTH_LABELS as MONTHS } from "./format";

export type JournalParams = Record<string, string | string[] | undefined>;

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const day = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : null);

export function journalFilters(sp: JournalParams) {
  const f = {
    compte: str(sp.compte), type: str(sp.type), categorie: str(sp.categorie),
    du: str(sp.du), au: str(sp.au), statut: str(sp.statut), q: str(sp.q).slice(0, 80),
  };
  const where: Prisma.OperationWhereInput = {};
  const and: Prisma.OperationWhereInput[] = [];
  if (f.compte) and.push({ OR: [{ accountId: f.compte }, { transferAccountId: f.compte }] });
  if (["INCOME", "EXPENSE", "TRANSFER"].includes(f.type)) where.type = f.type;
  if (f.categorie) where.categoryId = f.categorie;
  const from = day(f.du);
  const to = day(f.au);
  if (from || to) where.date = { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 86400e3) } : {}) };
  if (f.statut === "CANCELLED") where.cancelled = true;
  else if (["APPROVED", "PENDING", "REJECTED"].includes(f.statut)) Object.assign(where, { status: f.statut, cancelled: false });
  if (f.q) and.push({ OR: [{ description: { contains: f.q } }, { counterparty: { contains: f.q } }] });
  if (and.length) where.AND = and;
  return { f, where };
}

/** Période d'un bilan : année scolaire entière, ou un mois (?mois=AAAA-MM). */
export function reportPeriod(sp: JournalParams, currentSchoolYear: string, startMonth = 9) {
  const annee = /^\d{4}-\d{4}$/.test(str(sp.annee)) ? str(sp.annee) : currentSchoolYear;
  const mois = /^\d{4}-(0[1-9]|1[0-2])$/.test(str(sp.mois)) ? str(sp.mois) : "";
  const start = Number(annee.slice(0, 4));
  if (mois) {
    const [y, m] = mois.split("-").map(Number);
    return { annee, mois, from: new Date(y, m - 1, 1), to: new Date(y, m, 1), label: `${MONTHS[m - 1]} ${y}`, kind: "mensuel" as const };
  }
  return {
    annee, mois,
    from: new Date(start, startMonth - 1, 1), to: new Date(start + 1, startMonth - 1, 1),
    label: `Année scolaire ${annee}`, kind: "annuel" as const,
  };
}


/** AAAA-MM-JJ à l'heure locale (toISOString décalerait d'un jour à UTC+3). */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
