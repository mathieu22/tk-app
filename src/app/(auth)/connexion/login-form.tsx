"use client";
import { Lock, Phone } from "lucide-react";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <h2 className="m-0 text-xl font-bold">Connexion</h2>
      <div>
        <label className="gph-label" htmlFor="phone">Téléphone</label>
        <div className="relative">
          <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required
            placeholder="+261 34 12 345 67" defaultValue={state?.phone} className="gph-input with-icon" />
        </div>
      </div>
      <div>
        <label className="gph-label" htmlFor="password">Mot de passe</label>
        <div className="relative">
          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input id="password" name="password" type="password" autoComplete="current-password" required className="gph-input with-icon" />
        </div>
      </div>
      {state?.error && <p role="alert" className="gph-badge danger justify-center py-2.5 text-[13px]">{state.error}</p>}
      <button className="gph-btn-primary full mt-2" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
