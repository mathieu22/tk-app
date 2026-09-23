// Helpers serveur propres au module Cotisations.
import "server-only";
import { db } from "@/lib/db";
import type { DueStatus, FeeCode } from "@/lib/domain";
import { calendarYear } from "@/lib/fees";
import { schoolMonths } from "@/lib/format";
import { MONTH_SHORT } from "./months";

export const currentMonth = () => new Date().getMonth() + 1;

export function previousSchoolYear(sy: string) {
  const start = Number(sy.slice(0, 4));
  return `${start - 1}-${start}`;
}

/** Mois « de référence » d'une année : le mois courant pour l'année en cours, août pour une année passée. */
export function referenceMonth(schoolYear: string, currentSY: string) {
  return schoolYear === currentSY ? currentMonth() : 8;
}

/** Vrai si le mois n'est pas encore commencé (année en cours uniquement). */
export function isFutureMonth(month: number, schoolYear: string, currentSY: string) {
  if (schoolYear !== currentSY) return false;
  const order = schoolMonths();
  return order.indexOf(month) > order.indexOf(currentMonth());
}

/** Années scolaires disponibles (tarifs définis + année en cours), de la plus récente à la plus ancienne. */
export async function availableSchoolYears(currentSY: string) {
  const rows = await db.tariff.findMany({ select: { schoolYear: true }, distinct: ["schoolYear"] });
  return [...new Set([currentSY, ...rows.map((r) => r.schoolYear)])].sort().reverse();
}

export async function tariffFor(code: FeeCode, schoolYear: string) {
  const t = await db.tariff.findFirst({ where: { feeType: { code }, schoolYear, groupId: null } });
  return t?.amount ?? 0;
}

export type DueLite = { status: string; amountDue: number; amountPaid: number };

export function stats(dues: DueLite[]) {
  let paid = 0, partial = 0, unpaid = 0, collected = 0, expected = 0;
  for (const d of dues) {
    if (d.status === "PAID") paid++;
    else if (d.status === "PARTIAL") partial++;
    else unpaid++;
    collected += Math.min(d.amountPaid, d.amountDue);
    expected += d.amountDue;
  }
  return { paid, partial, unpaid, total: dues.length, collected, expected };
}

/** État agrégé d'un mois (pastille du carrousel). */
export function aggregateStatus(dues: DueLite[], future: boolean): DueStatus | "NONE" {
  if (future || dues.length === 0) return "NONE";
  if (dues.every((d) => d.status === "PAID")) return "PAID";
  if (dues.some((d) => d.status !== "UNPAID")) return "PARTIAL";
  return "UNPAID";
}

const time = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** « Aujourd'hui · 14:32 », « Hier · 16:45 », « 23 mai · 09:11 ». L'heure vient de la saisie. */
export function relativeWhen(date: Date, createdAt: Date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const day = sameDay(date, now)
    ? "Aujourd'hui"
    : sameDay(date, yesterday)
      ? "Hier"
      : date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).replace(".", "");
  return sameDay(date, createdAt) ? `${day} · ${time(createdAt)}` : day;
}

/** Période couverte par un paiement : « Avr, Mai 2026 », « Déc 2025 · Jan 2026 » ou « 2025-2026 ». */
export function periodLabel(dues: { schoolYear: string; month: number }[]) {
  if (dues.length === 0) return "—";
  if (dues.every((d) => d.month === 0)) return [...new Set(dues.map((d) => d.schoolYear))].join(", ");
  const order = schoolMonths();
  const sorted = [...dues].sort((a, b) => a.schoolYear.localeCompare(b.schoolYear) || order.indexOf(a.month) - order.indexOf(b.month));
  const groups: { year: number; months: string[] }[] = [];
  for (const d of sorted) {
    const year = calendarYear(d.schoolYear, d.month);
    const g = groups.at(-1);
    if (g && g.year === year) g.months.push(MONTH_SHORT[d.month]);
    else groups.push({ year, months: [MONTH_SHORT[d.month]] });
  }
  return groups.map((g) => `${g.months.join(", ")} ${g.year}`).join(" · ");
}
