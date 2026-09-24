"use client";
// Saisie du budget prévisionnel par catégorie (US-6.5).
import { useActionState } from "react";
import { saveBudget } from "@/app/actions/treasury";

export function BudgetForm({ schoolYear, children }: { schoolYear: string; children: React.ReactNode }) {
  const [state, action, pending] = useActionState(saveBudget, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="schoolYear" value={schoolYear} />
      {children}
      <div className="sticky bottom-24 mt-3 flex items-center gap-3 md:bottom-4">
        <button className="gph-btn-primary flex-1" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer le budget"}</button>
        {state?.message && <span role="status" className="text-sm font-semibold text-ink-2">{state.message}</span>}
      </div>
    </form>
  );
}
