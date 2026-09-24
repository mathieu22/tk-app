import { Ban, Check, Download, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelPayment } from "@/components/pay-cancel";
import { ShareReceipt } from "@/components/pay-share";
import { getAssociation, requirePermission } from "@/lib/dal";
import { formatAriary, formatDate, formatPhone } from "@/lib/format";
import { can } from "@/lib/permissions";
import { loadReceipt } from "../../receipt";
import { StatusBadge } from "../../status-row";

export const metadata: Metadata = { title: "Reçu de paiement" };

export default async function PaymentDetail({ params }: PageProps<"/cotisations/paiement/[id]">) {
  const user = await requirePermission("payment.viewAll");
  const { id } = await params;
  const [association, r] = await Promise.all([getAssociation(), loadReceipt(id)]);
  if (!r) notFound();
  const { payment } = r;
  const cancelled = payment.cancelled;

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Membre", value: r.memberName },
    { label: "Catégorie", value: `${r.feeLabel} — ${r.period}` },
    { label: "Mode", value: r.methodLabel },
    ...(payment.reference ? [{ label: "Référence", value: payment.reference, mono: true }] : []),
    { label: "Date", value: formatDate(payment.date) },
    { label: "N° de reçu", value: payment.receiptNo, mono: true },
    { label: "Saisi par", value: r.recordedBy },
  ];

  const shareText = [
    `Reçu ${payment.receiptNo} — ${association.name}`,
    `Membre : ${r.memberName}`,
    `${r.feeLabel} : ${r.period}`,
    `Montant : ${formatAriary(payment.totalAmount)}`,
    `Mode : ${r.methodLabel}${payment.reference ? ` (réf. ${payment.reference})` : ""}`,
    `Date : ${formatDate(payment.date)}`,
    ...(cancelled ? ["PAIEMENT ANNULÉ"] : []),
  ].join("\n");
  const pdfUrl = `/api/recus/${payment.id}`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[rgba(10,30,16,0.55)] p-5 backdrop-blur-[2px]">
      <div role="dialog" aria-labelledby="pay-ok" className="my-auto w-full max-w-sm rounded-[22px] bg-white px-6 pb-5 pt-7 text-center shadow-[0_30px_60px_rgba(0,0,0,0.3)]">
        <div className="mb-[18px] flex justify-center">
          {cancelled ? (
            <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[var(--gph-danger-soft)]">
              <Ban size={40} className="text-[var(--gph-danger-ink)]" strokeWidth={2.5} />
            </div>
          ) : (
            <div className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[linear-gradient(160deg,var(--gph-success)_0%,var(--gph-primary)_100%)] shadow-[0_14px_30px_rgba(16,185,129,0.4)]">
              <div className="absolute -inset-2 rounded-full border-2 border-[var(--gph-success-soft)] opacity-50" />
              <div className="absolute -inset-[18px] rounded-full border border-[var(--gph-success-soft)] opacity-30" />
              <Check size={44} color="#fff" strokeWidth={3} />
            </div>
          )}
        </div>

        <h2 id="pay-ok" className="m-0 text-[22px] font-bold tracking-[-0.02em]">
          {cancelled ? "Paiement annulé" : "Paiement enregistré"}
        </h2>
        <p className="mt-2 text-[13px] leading-normal text-ink-2">
          {cancelled ? (
            <>Motif : {payment.cancelReason} — par {r.cancelledBy}{payment.cancelledAt && ` le ${formatDate(payment.cancelledAt)}`}.</>
          ) : (
            <>Le reçu <span className="font-mono font-semibold">{payment.receiptNo}</span> a été généré.</>
          )}
        </p>

        <div className={`mt-[18px] rounded-[14px] bg-bg p-3.5 text-left ${cancelled ? "opacity-70" : ""}`}>
          {rows.map((row, i) => (
            <div key={row.label} className={`flex items-baseline justify-between gap-3 py-2 first:pt-0 ${i < rows.length - 1 ? "border-b border-dashed border-divider" : ""}`}>
              <span className="flex-none text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">{row.label}</span>
              <span className={`text-right text-[13px] font-semibold ${row.mono ? "font-mono" : ""}`}>{row.value}</span>
            </div>
          ))}
          {payment.note && <p className="border-t border-dashed border-divider pt-2 text-xs text-ink-2">{payment.note}</p>}
          {!cancelled && (
            <div className="mt-2.5 flex items-center justify-between border-t border-divider pt-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">Statut</span>
              <span className="flex flex-col items-end gap-1">
                <StatusBadge status={r.status} />
                {r.status !== "PAID" && r.pendingMonths.length > 0 && (
                  <span className="text-[11px] font-medium text-ink-3">Reste dû : {r.pendingMonths.join(", ")}</span>
                )}
              </span>
            </div>
          )}
          <div className="mt-2.5 flex items-baseline justify-between border-t border-divider pt-2.5">
            <span className="text-[13px] font-semibold">Total</span>
            <span className={`gph-amount text-xl font-bold ${cancelled ? "text-ink-3 line-through" : "text-primary"}`}>
              {formatAriary(payment.totalAmount)}
            </span>
          </div>
        </div>

        <div className="mt-[18px] flex gap-2">
          <a href={pdfUrl} download className="gph-btn-ghost flex-1">
            <Download size={15} /> Reçu PDF
          </a>
          <ShareReceipt
            pdfUrl={pdfUrl}
            filename={`${payment.receiptNo}.pdf`}
            text={shareText}
            phone={payment.member.phone ? formatPhone(payment.member.phone).replace(/\s/g, "") : null}
            email={payment.member.email}
          />
        </div>
        <Link href="/cotisations" className="gph-btn-primary full mt-2">
          <Check size={16} strokeWidth={2.5} />
          Terminé
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4">
          {can(user, "payment.create") && (
            <Link href="/cotisations/paiement" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary">
              <Plus size={16} strokeWidth={2.5} /> Nouveau paiement
            </Link>
          )}
          {!cancelled && can(user, "payment.cancel") && <CancelPayment paymentId={payment.id} receiptNo={payment.receiptNo} />}
        </div>
      </div>
    </div>
  );
}
