// Données d'un reçu, partagées par l'écran de confirmation et le PDF (US-3.5).
import "server-only";
import { db } from "@/lib/db";
import { fullName, OPERATORS, PAYMENT_METHODS, type DueStatus, type PaymentMethod } from "@/lib/domain";
import { formatPhone } from "@/lib/format";
import { periodLabel } from "./data";
import { MONTH_SHORT } from "./months";

export async function loadReceipt(id: string) {
  const payment = await db.payment.findUnique({
    where: { id },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, matricule: true } },
      allocations: {
        include: {
          due: {
            select: {
              schoolYear: true, month: true, status: true, eventId: true,
              feeType: { select: { code: true, label: true } }, event: { select: { title: true } },
            },
          },
        },
      },
    },
  });
  if (!payment) return null;
  const [recordedBy, cancelledBy] = await Promise.all([
    payment.recordedById ? db.user.findUnique({ where: { id: payment.recordedById }, select: { phone: true, member: { select: { firstName: true, lastName: true } } } }) : null,
    payment.cancelledById ? db.user.findUnique({ where: { id: payment.cancelledById }, select: { phone: true, member: { select: { firstName: true, lastName: true } } } }) : null,
  ]);
  const who = (u: typeof recordedBy) => (u ? (u.member ? fullName(u.member) : formatPhone(u.phone)) : "—");

  const dues = payment.allocations.map((a) => a.due);
  const first = dues[0];
  const isEvent = first?.feeType.code === "EVENT";
  const feeLabel = first?.feeType.label ?? "—";
  const period = isEvent ? (first?.event?.title ?? "Événement") : periodLabel(dues);
  const method = PAYMENT_METHODS[payment.method as PaymentMethod]?.label ?? payment.method;
  const operator = payment.operator ? OPERATORS[payment.operator as keyof typeof OPERATORS] : null;
  const pending = dues.filter((d) => d.status !== "PAID");
  const status: DueStatus = pending.length === 0 ? "PAID" : dues.some((d) => d.status !== "UNPAID") ? "PARTIAL" : "UNPAID";

  return {
    payment,
    memberName: fullName(payment.member),
    feeLabel,
    period,
    methodLabel: operator ? `${method} · ${operator}` : method,
    status,
    pendingMonths: pending.filter((d) => d.month > 0).map((d) => MONTH_SHORT[d.month]),
    recordedBy: who(recordedBy),
    cancelledBy: who(cancelledBy),
  };
}
export type Receipt = NonNullable<Awaited<ReturnType<typeof loadReceipt>>>;
