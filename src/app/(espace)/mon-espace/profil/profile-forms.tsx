"use client";
import { useActionState, useState, useTransition } from "react";
import { changePassword, setPhotoConsent } from "@/app/actions/espace";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="gph-card flex flex-col gap-3 p-3.5" key={state?.saved ? "saved" : "form"}>
      {([["current", "Mot de passe actuel", "current-password"], ["password", "Nouveau mot de passe", "new-password"], ["confirm", "Confirmation", "new-password"]] as const).map(([name, label, ac]) => (
        <div key={name}>
          <label className="gph-label" htmlFor={`pw-${name}`}>{label}</label>
          <input id={`pw-${name}`} name={name} type="password" autoComplete={ac} required minLength={name === "current" ? 1 : 8} className="gph-input" />
        </div>
      ))}
      {state?.error && <p role="alert" className="text-xs font-semibold text-danger">{state.error}</p>}
      {state?.saved && <p role="status" className="gph-badge success justify-center py-2">Mot de passe modifié.</p>}
      <button className="gph-btn-primary full" disabled={pending}>{pending ? "Enregistrement…" : "Changer le mot de passe"}</button>
    </form>
  );
}

export function ConsentToggle({ memberId, name, initial }: { memberId: string; name: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className="flex min-h-[52px] items-center justify-between gap-3 px-3.5">
      <span className="text-sm font-semibold">{name}</span>
      <input type="checkbox" checked={on} disabled={pending} className="h-5 w-5 accent-[var(--gph-primary)]"
        onChange={(e) => {
          const v = e.target.checked;
          setOn(v);
          start(() => setPhotoConsent(memberId, v).catch(() => setOn(!v)));
        }} />
    </label>
  );
}
