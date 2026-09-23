// Règles de gestion des cotisations (spec EPIC 3, US-3.4).
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import type { DueStatus, FeeCode } from "./domain";
import { schoolMonths } from "./format";

type Tx = Prisma.TransactionClient;

export function dueStatus(amountDue: number, amountPaid: number): DueStatus {
  if (amountPaid >= amountDue) return "PAID";
  if (amountPaid > 0) return "PARTIAL";
  return "UNPAID";
}

/** Année civile d'un mois de l'année scolaire "2025-2026" (sept→déc = 2025, janv→août = 2026). */
export function calendarYear(schoolYear: string, month: number, startMonth = 9) {
  const start = Number(schoolYear.slice(0, 4));
  return month >= startMonth ? start : start + 1;
}

/**
 * Crée les échéances manquantes pour les membres actifs d'une année scolaire :
 * Droit / Passport (une par an, month = 0) et Écolage (une par mois).
 * Idempotent : n'écrase jamais une échéance existante.
 */
export async function ensureDues(schoolYear: string) {
  const [members, feeTypes] = await Promise.all([
    db.member.findMany({ where: { status: "ACTIVE", archived: false }, select: { id: true } }),
    db.feeType.findMany({ where: { code: { in: ["DROIT", "PASSPORT", "ECOLAGE"] } }, include: { tariffs: { where: { schoolYear, groupId: null } } } }),
  ]);
  const existing = await db.due.findMany({ where: { schoolYear }, select: { memberId: true, feeTypeId: true, month: true } });
  const seen = new Set(existing.map((d) => `${d.memberId}|${d.feeTypeId}|${d.month}`));

  const rows: Prisma.DueCreateManyInput[] = [];
  for (const ft of feeTypes) {
    const amount = ft.tariffs[0]?.amount;
    if (!amount) continue;
    const months = ft.periodicity === "MONTHLY" ? schoolMonths() : [0];
    for (const m of members) {
      for (const month of months) {
        if (!seen.has(`${m.id}|${ft.id}|${month}`)) {
          rows.push({ memberId: m.id, feeTypeId: ft.id, schoolYear, month, amountDue: amount });
        }
      }
    }
  }
  if (rows.length) await db.due.createMany({ data: rows });
}

/** Numéro de reçu unique : REC-2026-00042 (séquence par année civile). */
async function nextReceiptNo(tx: Tx, date: Date) {
  const prefix = `REC-${date.getFullYear()}-`;
  const last = await tx.payment.findFirst({ where: { receiptNo: { startsWith: prefix } }, orderBy: { receiptNo: "desc" }, select: { receiptNo: true } });
  const n = last ? Number(last.receiptNo.slice(prefix.length)) + 1 : 1;
  return prefix + String(n).padStart(5, "0");
}

export type RecordPaymentInput = {
  memberId: string;
  feeCode: FeeCode;
  schoolYear: string;
  months: number[]; // vide pour Droit / Passport
  amount: number;
  method: string;
  operator?: string | null;
  reference?: string | null;
  note?: string | null;
  date: Date;
  recordedById: string;
};

/**
 * Enregistre un paiement et le répartit sur les échéances, du mois le plus ancien
 * au plus récent (ordre de l'année scolaire). Le dernier mois non soldé passe en Partiel.
 */
export async function recordPayment(input: RecordPaymentInput) {
  return db.$transaction(async (tx) => {
    const feeType = await tx.feeType.findUniqueOrThrow({ where: { code: input.feeCode } });
    const monthly = feeType.periodicity === "MONTHLY";
    const order = schoolMonths();
    const months = monthly ? [...input.months].sort((a, b) => order.indexOf(a) - order.indexOf(b)) : [0];
    if (monthly && months.length === 0) throw new Error("Sélectionnez au moins un mois.");

    const dues = await tx.due.findMany({
      where: { memberId: input.memberId, feeTypeId: feeType.id, schoolYear: input.schoolYear, month: { in: months } },
    });
    if (dues.length !== months.length) throw new Error("Échéance introuvable pour cette période.");
    dues.sort((a, b) => order.indexOf(a.month) - order.indexOf(b.month));
    if (dues.every((d) => d.amountPaid >= d.amountDue)) throw new Error("Cette période est déjà entièrement payée.");
    if (input.amount <= 0) throw new Error("Le montant doit être positif.");

    const receiptNo = await nextReceiptNo(tx, input.date);
    const payment = await tx.payment.create({
      data: {
        receiptNo,
        memberId: input.memberId,
        date: input.date,
        totalAmount: input.amount,
        method: input.method,
        operator: input.operator,
        reference: input.reference,
        note: input.note,
        recordedById: input.recordedById,
      },
    });

    let remaining = input.amount;
    for (const [i, due] of dues.entries()) {
      const outstanding = Math.max(0, due.amountDue - due.amountPaid);
      // Le trop-perçu éventuel est affecté à la dernière échéance (avertissement côté formulaire).
      const part = i === dues.length - 1 ? remaining : Math.min(remaining, outstanding);
      if (part <= 0) continue;
      remaining -= part;
      const amountPaid = due.amountPaid + part;
      await tx.due.update({ where: { id: due.id }, data: { amountPaid, status: dueStatus(due.amountDue, amountPaid) } });
      await tx.paymentAllocation.create({ data: { paymentId: payment.id, dueId: due.id, amount: part } });
    }

    await tx.auditLog.create({
      data: { userId: input.recordedById, action: "payment.create", entity: "Payment", entityId: payment.id, details: receiptNo },
    });
    return payment;
  });
}
