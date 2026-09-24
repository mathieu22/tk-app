"use client";
import { useActionState } from "react";
import { savePreferences } from "@/app/actions/espace";

export function PreferencesForm({ kinds }: { kinds: { kind: string; label: string; app: boolean; sms: boolean }[] }) {
  const [state, action, pending] = useActionState(savePreferences, undefined);
  return (
    <form action={action} className="px-4">
      <p className="mb-3 text-[13px] text-ink-2">Choisissez comment être prévenu. Les SMS peuvent dépendre de la passerelle du club.</p>
      <div className="gph-card overflow-hidden">
        <div className="grid grid-cols-[1fr_64px_64px] items-center border-b border-divider px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.03em] text-ink-3">
          <span>Type</span><span className="text-center">Appli</span><span className="text-center">SMS</span>
        </div>
        {kinds.map((k) => (
          <div key={k.kind} className="grid grid-cols-[1fr_64px_64px] items-center border-b border-divider px-3.5 py-3 last:border-none">
            <span className="text-sm font-semibold">{k.label}</span>
            {(["app", "sms"] as const).map((ch) => (
              <label key={ch} className="flex min-h-[44px] items-center justify-center">
                <input type="checkbox" name={`${k.kind}.${ch}`} defaultChecked={k[ch]} aria-label={`${k.label} — ${ch === "app" ? "application" : "SMS"}`}
                  className="h-5 w-5 accent-[var(--gph-primary)]" />
              </label>
            ))}
          </div>
        ))}
      </div>
      {state?.saved && <p role="status" className="gph-badge success mt-3 w-full justify-center py-2.5">Préférences enregistrées.</p>}
      <button className="gph-btn-primary full mt-3" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</button>
    </form>
  );
}
