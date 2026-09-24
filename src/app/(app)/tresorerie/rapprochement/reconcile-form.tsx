"use client";
// Rapprochement bancaire / Mobile Money (US-6.6 C) : import CSV, appariement, confirmation.
import { CheckCircle2, HelpCircle, Upload } from "lucide-react";
import { useActionState } from "react";
import { confirmReconcile, previewReconcile } from "@/app/actions/treasury";
import { formatAriary } from "@/lib/format";

const fmt = (n: number) => `${n < 0 ? "−" : "+"}${formatAriary(Math.abs(n))}`;

export function ReconcileForm({ accounts }: { accounts: { id: string; name: string }[] }) {
  const [preview, previewAction, previewing] = useActionState(previewReconcile, undefined);
  const [confirmState, confirmAction, confirming] = useActionState(confirmReconcile, undefined);

  const rows = confirmState?.message ? undefined : preview?.rows;
  const matched = rows?.filter((r) => r.match && !r.already) ?? [];

  return (
    <div className="flex flex-col gap-3.5">
      <form action={previewAction} className="gph-card flex flex-col gap-3 p-3.5 md:flex-row md:items-end">
        <label className="flex-1">
          <span className="gph-label">Compte</span>
          <select name="accountId" required defaultValue={preview?.accountId ?? ""} className="gph-input">
            <option value="" disabled>Choisir…</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="flex-1">
          <span className="gph-label">Relevé (CSV : date ; libellé ; montant)</span>
          <input type="file" name="file" accept=".csv,text/csv" required className="gph-input !py-2.5 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary" />
        </label>
        <button className="gph-btn-primary md:flex-none" disabled={previewing}>
          <Upload size={16} /> {previewing ? "Analyse…" : "Analyser"}
        </button>
      </form>

      {preview?.errors && preview.errors.length > 0 && (
        <div className="gph-card border-[var(--gph-warning)] bg-[var(--gph-warning-soft)] p-3.5 text-sm font-semibold text-[var(--gph-warning-ink)]">
          <div className="mb-1 flex items-center gap-1.5"><HelpCircle size={15} /> {preview.errors.length} ligne(s) ignorée(s)</div>
          <ul className="list-inside list-disc text-xs font-medium">{preview.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      {rows && rows.length > 0 && (
        <form action={confirmAction} className="gph-card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-divider px-4 py-3">
            <span className="text-sm font-bold">{rows.length} ligne(s) du relevé · {matched.length} à confirmer</span>
            <button className="gph-btn-primary !min-h-9 !py-1.5 text-xs" disabled={confirming || matched.length === 0}>
              {confirming ? "Confirmation…" : `Confirmer ${matched.length}`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">
                <tr>
                  <th className="px-3 py-2 text-left">Relevé</th><th className="px-3 py-2 text-right">Montant</th>
                  <th className="px-3 py-2 text-left">Opération correspondante</th><th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className="border-t border-divider">
                    <td className="px-3 py-2"><span className="block font-semibold">{r.label}</span><span className="text-xs text-ink-3">{r.date}</span></td>
                    <td className="gph-amount px-3 py-2 text-right font-semibold">{fmt(r.amount)}</td>
                    <td className="px-3 py-2">
                      {r.match ? (
                        <>
                          <span className="block">{r.match.description || "—"}</span>
                          <span className="text-xs text-ink-3">{r.match.date} · {formatAriary(r.match.amount)}</span>
                        </>
                      ) : <span className="text-xs text-ink-3">Aucune correspondance</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.match && (r.already
                        ? <span className="gph-badge success"><CheckCircle2 size={12} /> Déjà rapprochée</span>
                        : <label className="inline-flex items-center gap-1.5 text-xs font-semibold">
                            <input type="checkbox" name="opId" value={r.match.id} defaultChecked /> Confirmer
                          </label>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      )}
      {confirmState?.message && <p role="status" className="gph-badge success justify-center py-2.5">{confirmState.message}</p>}
    </div>
  );
}
