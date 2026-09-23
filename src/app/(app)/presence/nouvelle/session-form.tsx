"use client";
import { Check, ScanLine } from "lucide-react";
import { useActionState, useState } from "react";
import { createSession } from "@/app/actions/sessions";
import { FormTopBar } from "@/components/ui";

export function SessionForm({ groups, today }: { groups: { id: string; name: string }[]; today: string }) {
  const [state, action, pending] = useActionState(createSession, undefined);
  const v = state?.values ?? {};
  const e = state?.errors ?? {};
  const [groupId, setGroupId] = useState(v.groupId ?? "");

  return (
    <form action={action}>
      <FormTopBar cancelHref="/presence" title="Nouvelle session" />
      <div className="flex flex-col gap-3.5 px-4">
        <Field label="Titre" error={e.title}>
          <input name="title" required maxLength={120} defaultValue={v.title} placeholder="Entraînement du mardi"
            className="gph-input" aria-invalid={!!e.title} />
        </Field>
        <Field label="Date" error={e.date}>
          <input name="date" type="date" required defaultValue={v.date ?? today} className="gph-input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début" optional error={e.startTime}>
            <input name="startTime" type="time" defaultValue={v.startTime} className="gph-input" />
          </Field>
          <Field label="Fin" optional error={e.endTime}>
            <input name="endTime" type="time" defaultValue={v.endTime} className="gph-input" aria-invalid={!!e.endTime} />
          </Field>
        </div>
        <Field label="Groupe concerné" error={e.groupId}>
          <input type="hidden" name="groupId" value={groupId} />
          <div className="flex flex-wrap gap-2">
            {[{ id: "", name: "Tous les membres actifs" }, ...groups].map((g) => (
              <button type="button" key={g.id} onClick={() => setGroupId(g.id)}
                className={`gph-chip${groupId === g.id ? " active" : ""}`} aria-pressed={groupId === g.id}>
                {groupId === g.id && <Check size={12} strokeWidth={3} />}
                {g.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Lieu" optional>
          <input name="location" maxLength={120} defaultValue={v.location} placeholder="Gymnase d'Ankorondrano" className="gph-input" />
        </Field>

        <div className="mt-2 flex flex-col gap-2">
          <button name="intent" value="scan" className="gph-btn-primary full" disabled={pending}>
            <ScanLine size={18} strokeWidth={2.5} />
            Créer et lancer le scanner
          </button>
          <button name="intent" value="save" className="gph-btn-ghost w-full" disabled={pending}>
            Créer la session
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, optional, error, children }: { label: string; optional?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="gph-label">
        {label} {optional && <span className="opt">(optionnel)</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
