"use client";
import { Plus, Trash2 } from "lucide-react";
import { useActionState, useTransition } from "react";
import { addWeighIn, deleteWeighIn } from "@/app/actions/palmares";

export function WeighInForm({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState(addWeighIn, undefined);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return (
    <form action={action} className="flex items-end gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <div className="flex-1">
        <label className="gph-label">Date</label>
        <input name="date" type="date" defaultValue={today} max={today} className="gph-input py-2 text-[13px]" />
      </div>
      <div className="w-24">
        <label className="gph-label">Poids (kg)</label>
        <input name="weightKg" type="number" step="0.1" min={1} max={300} required className="gph-input py-2 text-[13px]" />
      </div>
      <button className="gph-icon-btn" disabled={pending} aria-label="Ajouter la pesée"><Plus size={16} /></button>
      {state?.errors?.weightKg && <p className="text-xs font-semibold text-danger">{state.errors.weightKg}</p>}
    </form>
  );
}

export function WeighInDeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="text-ink-3 hover:text-danger" disabled={pending} aria-label="Supprimer la pesée" onClick={() => start(() => deleteWeighIn(id))}>
      <Trash2 size={13} />
    </button>
  );
}
