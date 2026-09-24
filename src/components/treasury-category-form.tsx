"use client";
// Catégories de recettes / dépenses personnalisables (US-6.3).
import { Check, Pencil, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { deleteCategory, saveCategory } from "@/app/actions/treasury";

export function NewCategoryForm({ type }: { type: "INCOME" | "EXPENSE" }) {
  const [state, action, pending] = useActionState(saveCategory, undefined);
  return (
    <form action={action} className="flex gap-2">
      <input type="hidden" name="type" value={type} />
      <input name="name" required maxLength={60} placeholder="Nouvelle catégorie" className="gph-input !py-2.5" aria-label="Nom de la catégorie" key={state?.message} />
      <button className="gph-btn-primary flex-none" disabled={pending}>Ajouter</button>
      {state?.errors?.name && <span role="alert" className="self-center text-xs font-semibold text-danger">{state.errors.name}</span>}
    </form>
  );
}

export function CategoryRow({ id, name, type, system, used }: { id: string; name: string; type: string; system: boolean; used: number }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(saveCategory, undefined);
  const [deleting, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (editing && !state?.message) {
    return (
      <form action={action} className="flex items-center gap-2 px-3.5 py-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="type" value={type} />
        <input name="name" defaultValue={name} required maxLength={60} autoFocus className="gph-input !py-2" aria-label="Nom" />
        <button className="gph-icon-btn" disabled={pending} aria-label="Enregistrer"><Check size={16} /></button>
        {state?.errors?.name && <span className="text-xs text-danger">{state.errors.name}</span>}
      </form>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3.5 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="text-[11px] text-ink-3">{system ? "Automatique (paiements)" : `${used} opération${used > 1 ? "s" : ""}`}</span>
      </span>
      {error && <span className="text-xs text-danger">{error}</span>}
      {!system && (
        <>
          <button type="button" className="gph-icon-btn" onClick={() => setEditing(true)} aria-label="Renommer"><Pencil size={14} /></button>
          {used === 0 && (
            <button type="button" className="gph-icon-btn text-danger" disabled={deleting} aria-label="Supprimer"
              onClick={() => confirm(`Supprimer « ${name} » ?`) && start(async () => {
                try { await deleteCategory(id); } catch (e) { setError(e instanceof Error ? e.message : "Erreur."); }
              })}>
              <Trash2 size={14} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
