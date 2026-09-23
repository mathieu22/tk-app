// Règles de gestion des cotisations (spec EPIC 3, US-3.4).
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import type { DueStatus, FeeCode } from "./domain";
import { schoolMonths, schoolYearOf } from "./format";

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
    db.member.findMany({ where: { status: "ACTIVE", archived: false }, select: { id: true, groupId: true } }),
    db.feeType.findMany({ where: { code: { in: ["DROIT", "PASSPORT", "ECOLAGE"] } }, include: { tariffs: { where: { schoolYear } } } }),
  ]);
  const existing = await db.due.findMany({ where: { schoolYear, eventKey: "" }, select: { memberId: true, feeTypeId: true, month: true } });
  const seen = new Set(existing.map((d) => `${d.memberId}|${d.feeTypeId}|${d.month}`));

  const rows: Prisma.DueCreateManyInput[] = [];
  for (const ft of feeTypes) {
    const base = ft.tariffs.find((t) => t.groupId === null)?.amount;
    const months = ft.periodicity === "MONTHLY" ? schoolMonths() : [0];
    for (const m of members) {
      // Tarif du groupe du membre s'il existe (tarifs par catégorie, US-3 S), sinon tarif général.
      const amount = ft.tariffs.find((t) => t.groupId && t.groupId === m.groupId)?.amount ?? base;
      if (!amount) continue;
      for (const month of months) {
        if (!seen.has(`${m.id}|${ft.id}|${month}`)) {
          rows.push({ memberId: m.id, feeTypeId: ft.id, schoolYear, month, amountDue: amount });
        }
      }
    }
  }
  if (rows.length) await db.due.createMany({ data: rows });
}

/**
 * Frais d'un événement (US-1.7) : une échéance de type EVENT par participant confirmé
 * (réponse YES, ou convoqué). Idempotent ; ne supprime pas les échéances déjà payées.
 */
export async function ensureEventDues(eventId: string) {
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId }, include: { registrations: true } });
  if (!event.fee) return;
  const feeType = await db.feeType.findUniqueOrThrow({ where: { code: "EVENT" } });
  const schoolYear = schoolYearOf(event.startDate);
  const participants = event.registrations
    .filter((r) => r.response === "YES" || (event.participationMode === "SUMMONS" && r.response !== "NO"))
    .map((r) => r.memberId);
  const existing = await db.due.findMany({ where: { eventKey: event.id }, select: { memberId: true } });
  const have = new Set(existing.map((d) => d.memberId));
  const rows = participants.filter((id) => !have.has(id)).map((memberId) => ({
    memberId, feeTypeId: feeType.id, schoolYear, month: 0, amountDue: event.fee!, eventId: event.id, eventKey: event.id,
  }));
  if (rows.length) await db.due.createMany({ data: rows });
}

/** Compte de trésorerie correspondant au mode de paiement (US-6.2). */
async function accountFor(tx: Tx, method: string, operator?: string | null) {
  const type = method === "CASH" ? "CASH" : method === "MOBILE_MONEY" ? "MOBILE_MONEY" : "BANK";
  return (
    (type === "MOBILE_MONEY" && operator
      ? await tx.treasuryAccount.findFirst({ where: { type, operator, active: true } })
      : null) ?? (await tx.treasuryAccount.findFirst({ where: { type, active: true }, orderBy: { name: "asc" } }))
  );
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
  months: number[]; // vide pour Droit / Passport / Événement
  eventId?: string | null; // obligatoire pour le type EVENT
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

    if (input.feeCode === "EVENT" && !input.eventId) throw new Error("Événement manquant.");
    const dues = await tx.due.findMany({
      where: {
        memberId: input.memberId, feeTypeId: feeType.id, month: { in: months }, eventKey: input.eventId ?? "",
        // Les frais d'événement ne dépendent pas de l'année scolaire choisie
        ...(input.eventId ? {} : { schoolYear: input.schoolYear }),
      },
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

    // Recette automatique en trésorerie sur le compte du mode de paiement (US-6.2).
    const account = await accountFor(tx, input.method, input.operator);
    if (account) {
      const category = await tx.operationCategory.upsert({
        where: { name_type: { name: "Cotisations", type: "INCOME" } },
        update: {},
        create: { name: "Cotisations", type: "INCOME", system: true },
      });
      await tx.operation.create({
        data: {
          accountId: account.id, date: input.date, type: "INCOME", categoryId: category.id, amount: input.amount,
          description: `${feeType.label} — reçu ${receiptNo}`, paymentId: payment.id, recordedById: input.recordedById,
        },
      });
    }

    await tx.auditLog.create({
      data: { userId: input.recordedById, action: "payment.create", entity: "Payment", entityId: payment.id, details: receiptNo },
    });
    return payment;
  });
}

/**
 * Annule un paiement (US-3.4 : jamais supprimé) : les échéances sont recalculées
 * et la recette de trésorerie liée est annulée.
 */
export async function cancelPayment(paymentId: string, reason: string, userId: string) {
  if (!reason.trim()) throw new Error("Le motif est obligatoire.");
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { allocations: { include: { due: true } } } });
    if (payment.cancelled) throw new Error("Ce paiement est déjà annulé.");
    for (const a of payment.allocations) {
      const amountPaid = Math.max(0, a.due.amountPaid - a.amount);
      await tx.due.update({ where: { id: a.dueId }, data: { amountPaid, status: dueStatus(a.due.amountDue, amountPaid) } });
    }
    const now = new Date();
    await tx.payment.update({
      where: { id: payment.id },
      data: { cancelled: true, cancelReason: reason.trim(), cancelledAt: now, cancelledById: userId },
    });
    await tx.operation.updateMany({
      where: { paymentId: payment.id, cancelled: false },
      data: { cancelled: true, cancelReason: `Paiement ${payment.receiptNo} annulé : ${reason.trim()}`, cancelledAt: now },
    });
    await tx.auditLog.create({
      data: { userId, action: "payment.cancel", entity: "Payment", entityId: payment.id, details: `${payment.receiptNo} — ${reason.trim()}` },
    });
  });
}
