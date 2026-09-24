"use client";
// Validation / rejet d'une dépense et annulation motivée d'une opération (US-6.3, 6.7).
import { Ban, Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { cancelOperation, reviewExpense } from "@/app/actions/treasury";

function ReasonForm({ label, confirm, tone, onSubmit, onClose }: {
  label: string; confirm: string; tone: "danger" | "primary";
  onSubmit: (reason: string) => Promise<void>; onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="gph-card mt-2 flex flex-col gap-2 p-3.5">
      <label className="gph-label" htmlFor="reason">{label}</label>
      <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} className="gph-input" autoFocus />
      {error && <p role="alert" className="text-xs font-semibold text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="gph-btn-ghost flex-1" onClick={onClose}>Retour</button>
        <button type="button" disabled={pending || !reason.trim()}
          className={`gph-btn-primary flex-1 ${tone === "danger" ? "!bg-[var(--gph-danger)]" : ""}`}
          onClick={() => start(async () => {
            try {
              setError(null);
              await onSubmit(reason);
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Erreur.");
            }
          })}>
          {confirm}
        </button>
      </div>
    </div>
  );
}

export function ReviewButtons({ id }: { id: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <div className="flex gap-2">
        <button className="gph-btn-ghost flex-1 text-danger" onClick={() => setRejecting(true)} disabled={pending}>
          <X size={16} /> Rejeter
        </button>
        <button className="gph-btn-primary flex-1" disabled={pending}
          onClick={() => start(async () => {
            try { await reviewExpense(id, "APPROVED", ""); } catch (e) { setError(e instanceof Error ? e.message : "Erreur."); }
          })}>
          <Check size={16} strokeWidth={2.5} /> Valider
        </button>
      </div>
      {error && <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">{error}</p>}
      {rejecting && (
        <ReasonForm label="Motif du rejet" confirm="Rejeter la dépense" tone="danger"
          onSubmit={(r) => reviewExpense(id, "REJECTED", r)} onClose={() => setRejecting(false)} />
      )}
    </div>
  );
}

export function CancelOperationButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {!open && (
        <button className="gph-btn-ghost w-full text-danger" onClick={() => setOpen(true)}>
          <Ban size={16} /> Annuler l&apos;opération
        </button>
      )}
      {open && (
        <ReasonForm label="Motif de l'annulation" confirm="Confirmer l'annulation" tone="danger"
          onSubmit={(r) => cancelOperation(id, r)} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
