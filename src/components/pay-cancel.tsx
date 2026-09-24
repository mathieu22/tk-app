"use client";
// Annulation d'un paiement avec motif obligatoire (US-3.4).
import { Ban } from "lucide-react";
import { useActionState, useState } from "react";
import { cancelPaymentAction } from "@/app/actions/payments";

export function CancelPayment({ paymentId, receiptNo }: { paymentId: string; receiptNo: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(cancelPaymentAction, undefined);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-danger">
        <Ban size={15} /> Annuler le paiement
      </button>
    );
  }
  return (
    <form action={action} className="mt-3 rounded-[14px] border border-[var(--gph-danger-soft)] bg-[var(--gph-danger-soft)]/40 p-3 text-left">
      <input type="hidden" name="paymentId" value={paymentId} />
      <label htmlFor="reason" className="gph-label">Motif de l&apos;annulation</label>
      <textarea id="reason" name="reason" required maxLength={300} rows={2} autoFocus
        placeholder="Erreur de saisie, doublon, remboursement…" className="gph-input text-sm" />
      <p className="mt-1.5 text-[11px] font-medium text-ink-3">
        Le reçu {receiptNo} restera visible, barré. Les échéances et la trésorerie seront recalculées.
      </p>
      {state?.error && <p role="alert" className="mt-2 text-xs font-semibold text-[var(--gph-danger-ink)]">{state.error}</p>}
      <div className="mt-2.5 flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="gph-btn-ghost flex-1">Retour</button>
        <button disabled={pending} className="gph-btn-primary flex-1 !bg-[var(--gph-danger)]">
          {pending ? "Annulation…" : "Confirmer l'annulation"}
        </button>
      </div>
    </form>
  );
}
