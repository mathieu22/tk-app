"use client";
// Matrice des permissions configurable (spec §2.2) : permissions × profils.
import { Check, Lock, RotateCcw } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { resetPermissions, savePermissions } from "@/app/actions/settings";
import { PROFILE_LABELS } from "./settings-defaults";
import { FormMessage } from "./settings-ui";

const PROFILES = ["ADMIN", "PRESIDENT", "SECRETARY", "TREASURER", "COACH", "ATHLETE", "PARENT"];
const SHORT: Record<string, string> = {
  ADMIN: "Admin", PRESIDENT: "Prés.", SECRETARY: "Secr.", TREASURER: "Trés.", COACH: "Encad.", ATHLETE: "Athl.", PARENT: "Parent",
};
/** Droits d'administration toujours conservés par l'administrateur. */
const LOCKED = new Set(["settings:ADMIN", "user.manage:ADMIN"]);

export function SettingsPermissions({ labels, matrix, defaults }: {
  labels: Record<string, string>; matrix: Record<string, string[]>; defaults: Record<string, string[]>;
}) {
  const [state, action, pending] = useActionState(savePermissions, undefined);
  const [resetting, startReset] = useTransition();
  const [checked, setChecked] = useState(() => {
    const s = new Set<string>();
    for (const [perm, profiles] of Object.entries(matrix)) for (const p of profiles) s.add(`${perm}:${p}`);
    return s;
  });
  const toggle = (key: string) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  return (
    <form action={action} className="flex flex-col gap-3 px-4">
      <div className="gph-card overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-divider text-left">
              <th className="sticky left-0 bg-card px-3 py-3 font-bold">Fonction</th>
              {PROFILES.map((p) => (
                <th key={p} className="px-1 py-3 text-center text-xs font-bold text-ink-2" title={PROFILE_LABELS[p]}>{SHORT[p]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(labels).map(([perm, label]) => (
              <tr key={perm} className="border-b border-divider last:border-none">
                <th scope="row" className="sticky left-0 bg-card px-3 py-2 text-left font-medium">{label}</th>
                {PROFILES.map((p) => {
                  const key = `${perm}:${p}`;
                  const on = checked.has(key) || LOCKED.has(key);
                  const changed = on !== defaults[perm].includes(p);
                  return (
                    <td key={p} className="px-1 py-1.5 text-center" style={changed ? { background: "var(--gph-warning-soft)" } : undefined}>
                      {LOCKED.has(key) ? (
                        <>
                          <input type="hidden" name={key} value="on" />
                          <Lock size={14} className="mx-auto text-ink-3" aria-label="Toujours autorisé" />
                        </>
                      ) : (
                        <input type="checkbox" name={key} checked={on} onChange={() => toggle(key)}
                          aria-label={`${label} — ${PROFILE_LABELS[p]}`} className="h-5 w-5 cursor-pointer accent-[var(--gph-primary)]" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-3">
        Les parents et athlètes n&apos;accèdent qu&apos;à « Mon espace » (leurs propres données / celles de leurs enfants), quelle que soit la matrice.
        Les modifications s&apos;appliquent immédiatement à tous les utilisateurs.
      </p>
      <FormMessage state={state} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className="gph-btn-ghost flex-1" disabled={resetting}
          onClick={() => {
            if (!confirm("Rétablir la matrice par défaut du cahier des charges ?")) return;
            const s = new Set<string>();
            for (const [perm, profiles] of Object.entries(defaults)) for (const p of profiles) s.add(`${perm}:${p}`);
            setChecked(s);
            startReset(() => resetPermissions());
          }}>
          <RotateCcw size={15} /> Matrice par défaut
        </button>
        <button className="gph-btn-primary flex-1" disabled={pending}><Check size={16} strokeWidth={2.5} /> Enregistrer</button>
      </div>
    </form>
  );
}
