// Trésorerie (EPIC 6) : soldes, séries mensuelles, compte de résultat, budget.
// Règle commune : seules les opérations validées (APPROVED) et non annulées comptent.
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { MONTH_LABELS, schoolMonths } from "./format";

export const ACCOUNT_TYPES = { CASH: "Caisse (espèces)", MOBILE_MONEY: "Mobile Money", BANK: "Banque" } as const;
export type AccountType = keyof typeof ACCOUNT_TYPES;
export const OPERATION_TYPES = { INCOME: "Recette", EXPENSE: "Dépense", TRANSFER: "Virement" } as const;
export type OperationType = keyof typeof OPERATION_TYPES;
export const OPERATION_STATUS = { APPROVED: "Validée", PENDING: "À valider", REJECTED: "Rejetée" } as const;

/** Filtre des opérations prises en compte dans les soldes et bilans. */
export const COUNTED: Prisma.OperationWhereInput = { cancelled: false, status: "APPROVED" };

type Op = { type: string; amount: number; accountId: string; transferAccountId: string | null };

/** Effet d'une opération sur le solde d'un compte (pur). */
export function effectOn(accountId: string, op: Op): number {
  if (op.type === "INCOME") return op.accountId === accountId ? op.amount : 0;
  if (op.type === "EXPENSE") return op.accountId === accountId ? -op.amount : 0;
  // Virement : débit du compte source, crédit du compte destination
  let e = 0;
  if (op.accountId === accountId) e -= op.amount;
  if (op.transferAccountId === accountId) e += op.amount;
  return e;
}

/** Soldes en temps réel de tous les comptes : solde initial + mouvements comptés. */
export async function accountBalances(opts: { includeInactive?: boolean; until?: Date } = {}) {
  const [accounts, ops] = await Promise.all([
    db.treasuryAccount.findMany({ where: opts.includeInactive ? {} : { active: true }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
    db.operation.findMany({
      where: { ...COUNTED, ...(opts.until ? { date: { lt: opts.until } } : {}) },
      select: { type: true, amount: true, accountId: true, transferAccountId: true },
    }),
  ]);
  return accounts.map((a) => ({
    ...a,
    balance: a.openingBalance + ops.reduce((s, op) => s + effectOn(a.id, op), 0),
  }));
}

/** Bornes [début, fin[ d'une année scolaire "2025-2026". */
export function schoolYearRange(schoolYear: string, startMonth = 9): [Date, Date] {
  const y = Number(schoolYear.slice(0, 4));
  return [new Date(y, startMonth - 1, 1), new Date(y + 1, startMonth - 1, 1)];
}

export function monthRange(year: number, month: number): [Date, Date] {
  return [new Date(year, month - 1, 1), new Date(year, month, 1)];
}

/** Recettes / dépenses par mois de l'année scolaire (virements exclus : sans impact sur le résultat). */
export async function monthlySeries(schoolYear: string, startMonth = 9) {
  const [from, to] = schoolYearRange(schoolYear, startMonth);
  const ops = await db.operation.findMany({
    where: { ...COUNTED, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: from, lt: to } },
    select: { type: true, amount: true, date: true },
  });
  const start = Number(schoolYear.slice(0, 4));
  return schoolMonths(startMonth).map((m) => {
    const year = m >= startMonth ? start : start + 1;
    const inMonth = ops.filter((o) => o.date.getFullYear() === year && o.date.getMonth() + 1 === m);
    const income = inMonth.filter((o) => o.type === "INCOME").reduce((s, o) => s + o.amount, 0);
    const expense = inMonth.filter((o) => o.type === "EXPENSE").reduce((s, o) => s + o.amount, 0);
    return { month: m, year, label: MONTH_LABELS[m - 1].slice(0, 3), income, expense, net: income - expense };
  });
}

/** Compte de résultat simplifié par catégorie sur une période. */
export async function incomeStatement(from: Date, to: Date) {
  const [ops, categories] = await Promise.all([
    db.operation.groupBy({
      by: ["type", "categoryId"],
      where: { ...COUNTED, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
    db.operationCategory.findMany({ orderBy: { name: "asc" } }),
  ]);
  const line = (type: string) =>
    ops
      .filter((o) => o.type === type)
      .map((o) => ({ name: categories.find((c) => c.id === o.categoryId)?.name ?? "Sans catégorie", amount: o._sum.amount ?? 0 }))
      .sort((a, b) => b.amount - a.amount);
  const income = line("INCOME");
  const expense = line("EXPENSE");
  const totalIncome = income.reduce((s, l) => s + l.amount, 0);
  const totalExpense = expense.reduce((s, l) => s + l.amount, 0);
  return { income, expense, totalIncome, totalExpense, result: totalIncome - totalExpense };
}

/** Budget prévu / réalisé par catégorie pour une année scolaire. */
export async function budgetComparison(schoolYear: string, startMonth = 9) {
  const [from, to] = schoolYearRange(schoolYear, startMonth);
  const [categories, budgets, realised] = await Promise.all([
    db.operationCategory.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
    db.budget.findMany({ where: { schoolYear } }),
    db.operation.groupBy({
      by: ["categoryId"],
      where: { ...COUNTED, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
  ]);
  return categories.map((c) => {
    const planned = budgets.find((b) => b.categoryId === c.id)?.amount ?? 0;
    const actual = realised.find((r) => r.categoryId === c.id)?._sum.amount ?? 0;
    const pct = planned ? Math.round((actual / planned) * 100) : null;
    // Dépassement : dépense au-delà du prévu ; pour une recette, on signale seulement l'atteinte de l'objectif.
    const over = c.type === "EXPENSE" && planned > 0 && actual > planned;
    return { category: c, planned, actual, pct, over };
  });
}

/** Mot-clé d'audit marquant une opération rapprochée d'un relevé (pas de champ dédié dans le schéma). */
export const RECONCILE_ACTION = "treasury.reconcile";

export async function reconciledIds(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const logs = await db.auditLog.findMany({ where: { action: RECONCILE_ACTION, entityId: { in: ids } }, select: { entityId: true } });
  return new Set(logs.map((l) => l.entityId!));
}

/** Parse un relevé CSV (date ; libellé ; montant) — séparateur , ou ; ; dates JJ/MM/AAAA ou AAAA-MM-JJ. */
export function parseStatementCsv(text: string) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sep = (lines[0]?.match(/;/g)?.length ?? 0) >= (lines[0]?.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: { line: number; date: Date; label: string; amount: number }[] = [];
  const errors: string[] = [];
  lines.forEach((raw, i) => {
    const cells = raw.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cells.length < 3) return errors.push(`Ligne ${i + 1} : 3 colonnes attendues`);
    const [d, label, a] = [cells[0], cells.slice(1, -1).join(" "), cells[cells.length - 1]];
    const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) ?? d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) {
      if (i === 0) return; // ligne d'en-tête
      return errors.push(`Ligne ${i + 1} : date invalide « ${d} »`);
    }
    const date = d.includes("/") ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date(+m[1], +m[2] - 1, +m[3]);
    const amount = Number(a.replace(/[\s  ]|Ar/g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount === 0) return errors.push(`Ligne ${i + 1} : montant invalide « ${a} »`);
    rows.push({ line: i + 1, date, label, amount: Math.round(amount) });
  });
  return { rows, errors };
}
