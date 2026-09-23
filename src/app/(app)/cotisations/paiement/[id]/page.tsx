import { Check, Plus, Share2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { fullName, OPERATORS, PAYMENT_METHODS, type DueStatus, type PaymentMethod } from "@/lib/domain";
import { formatAriary, formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { periodLabel } from "../../data";
import { MONTH_SHORT } from "../../months";
import { StatusBadge } from "../../status-row";

export const metadata: Metadata = { title: "Paiement enregistré" };

export default async function PaymentSuccess({ params }: PageProps<"/cotisations/paiement/[id]">) {
  const user = await requirePermission("payment.viewAll");
  const { id } = await params;
  const [association, payment] = await Promise.all([
    getAssociation(),
    db.payment.findUnique({
      where: { id },
      include: {
        member: { select: { firstName: true, lastName: true } },
        allocations: {
          include: { due: { select: { schoolYear: true, month: true, status: true, feeType: { select: { label: true } } } } },
        },
      },
    }),
  ]);
  if (!payment) notFound();

  const dues = payment.allocations.map((a) => a.due);
  const feeLabel = dues[0]?.feeType.label ?? "—";
  const period = periodLabel(dues);
  const method = PAYMENT_METHODS[payment.method as PaymentMethod]?.label ?? payment.method;
  const operator = payment.operator ? OPERATORS[payment.operator as keyof typeof OPERATORS] : null;
  const name = fullName(payment.member);
  // Statut actuel des échéances couvertes (Payé / Partiel)
  const partialMonths = dues.filter((d) => d.status !== "PAID");
  const overall: DueStatus = partialMonths.length === 0 ? "PAID" : "PARTIAL";

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Membre", value: name },
    { label: "Catégorie", value: `${feeLabel} — ${period}` },
    { label: "Mode", value: operator ? `${method} · ${operator}` : method },
    ...(payment.reference ? [{ label: "Référence", value: payment.reference, mono: true }] : []),
    { label: "Date", value: formatDate(payment.date) },
    { label: "N° de reçu", value: payment.receiptNo, mono: true },
  ];

  const shareText = [
    `Reçu ${payment.receiptNo} — ${association.name}`,
    `Membre : ${name}`,
    `${feeLabel} : ${period}`,
    `Montant : ${formatAriary(payment.totalAmount)}`,
    `Mode : ${rows[2].value}${payment.reference ? ` (réf. ${payment.reference})` : ""}`,
    `Date : ${formatDate(payment.date)}`,
  ].join("\n");

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[rgba(10,30,16,0.55)] p-5 backdrop-blur-[2px]">
      <div role="dialog" aria-labelledby="pay-ok" className="w-full max-w-sm rounded-[22px] bg-white px-6 pb-5 pt-7 text-center shadow-[0_30px_60px_rgba(0,0,0,0.3)]">
        <div className="mb-[18px] flex justify-center">
          <div className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[linear-gradient(160deg,var(--gph-success)_0%,var(--gph-primary)_100%)] shadow-[0_14px_30px_rgba(16,185,129,0.4)]">
            <div className="absolute -inset-2 rounded-full border-2 border-[var(--gph-success-soft)] opacity-50" />
            <div className="absolute -inset-[18px] rounded-full border border-[var(--gph-success-soft)] opacity-30" />
            <Check size={44} color="#fff" strokeWidth={3} />
          </div>
        </div>

        <h2 id="pay-ok" className="m-0 text-[22px] font-bold tracking-[-0.02em]">
          {payment.cancelled ? "Paiement annulé" : "Paiement enregistré"}
        </h2>
        <p className="mt-2 text-[13px] leading-normal text-ink-2">
          Le reçu <span className="font-mono font-semibold">{payment.receiptNo}</span> a été généré.
        </p>

        <div className="mt-[18px] rounded-[14px] bg-bg p-3.5 text-left">
          {rows.map((r, i) => (
            <div key={r.label} className={`flex items-baseline justify-between gap-3 py-2 first:pt-0 ${i < rows.length - 1 ? "border-b border-dashed border-divider" : ""}`}>
              <span className="flex-none text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">{r.label}</span>
              <span className={`text-right text-[13px] font-semibold ${r.mono ? "font-mono" : ""}`}>{r.value}</span>
            </div>
          ))}
          <div className="mt-2.5 flex items-center justify-between border-t border-divider pt-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">Statut</span>
            <span className="flex flex-col items-end gap-1">
              <StatusBadge status={overall} />
              {overall === "PARTIAL" && partialMonths.some((d) => d.month > 0) && (
                <span className="text-[11px] font-medium text-ink-3">
                  Reste dû : {partialMonths.map((d) => MONTH_SHORT[d.month]).join(", ")}
                </span>
              )}
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between border-t border-divider pt-2.5">
            <span className="text-[13px] font-semibold">Total</span>
            <span className="gph-amount text-xl font-bold text-primary">{formatAriary(payment.totalAmount)}</span>
          </div>
        </div>

        <div className="mt-[18px] flex gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="gph-btn-ghost flex-1"
          >
            <Share2 size={15} /> Partager
          </a>
          <Link href="/cotisations" className="gph-btn-primary flex-1">
            <Check size={16} strokeWidth={2.5} />
            Terminé
          </Link>
        </div>
        {can(user, "payment.create") && (
          <Link href="/cotisations/paiement" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary">
            <Plus size={16} strokeWidth={2.5} /> Nouveau paiement
          </Link>
        )}
      </div>
    </div>
  );
}
