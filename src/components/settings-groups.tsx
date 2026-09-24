"use client";
// US-8.2 : groupes d'entraînement (création, modification, suppression si inutilisé).
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { deleteGroup, saveGroup, type FormState } from "@/app/actions/settings";
import { FormMessage } from "./settings-ui";

type Group = { id: string; name: string; description: string; members: number; sessions: number };

function GroupForm({ group, onDone }: { group?: Group; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await saveGroup(prev, fd);
    if (r?.ok) onDone?.();
    return r;
  }, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={group?.id ?? ""} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="name" required maxLength={60} defaultValue={group?.name} placeholder="Nom du groupe" aria-label="Nom" className="gph-input sm:w-56" />
        <input name="description" maxLength={200} defaultValue={group?.description} placeholder="Description (créneau, lieu…)" aria-label="Description" className="gph-input flex-1" />
        <div className="flex gap-2">
          {onDone && group && (
            <button type="button" onClick={onDone} className="gph-btn-ghost" aria-label="Annuler"><X size={16} /></button>
          )}
          <button className="gph-btn-primary flex-1 whitespace-nowrap" disabled={pending}>
            {group ? <><Check size={16} /> Enregistrer</> : <><Plus size={16} /> Ajouter</>}
          </button>
        </div>
      </div>
      <FormMessage state={state?.error ? state : undefined} />
    </form>
  );
}

export function SettingsGroups({ groups }: { groups: Group[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<FormState>(undefined);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3 px-4">
      <div className="gph-card p-3.5"><GroupForm /></div>
      <FormMessage state={msg} />
      {groups.map((g) => (
        <div key={g.id} className="gph-card p-3.5">
          {editing === g.id ? (
            <GroupForm group={g} onDone={() => setEditing(null)} />
          ) : (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">{g.name}</div>
                <div className="text-xs font-medium text-ink-3">
                  {g.description && `${g.description} · `}{g.members} membre{g.members > 1 ? "s" : ""} · {g.sessions} séance{g.sessions > 1 ? "s" : ""}
                </div>
              </div>
              <button onClick={() => setEditing(g.id)} className="gph-icon-btn" aria-label={`Modifier ${g.name}`}><Pencil size={15} /></button>
              <button disabled={pending} className="gph-icon-btn text-danger" aria-label={`Supprimer ${g.name}`}
                onClick={() => {
                  if (!confirm(`Supprimer le groupe « ${g.name} » ?`)) return;
                  start(async () => setMsg(await deleteGroup(g.id)));
                }}>
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
      ))}
      {groups.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3">Aucun groupe.</div>}
    </div>
  );
}
