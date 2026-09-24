"use client";
import { Lock } from "lucide-react";
import { useActionState } from "react";
import { activate } from "@/app/actions/auth";

export function ActivateForm({ token, reset }: { token: string; reset: boolean }) {
  const [state, action, pending] = useActionState(activate.bind(null, token), undefined);
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <h2 className="m-0 text-xl font-bold">{reset ? "Choisissez un nouveau mot de passe" : "Créez votre mot de passe"}</h2>
      <p className="text-sm text-ink-2">Au moins 8 caractères. Vous vous connecterez ensuite avec votre numéro de téléphone.</p>
      {(["password", "confirm"] as const).map((name) => (
        <div key={name}>
          <label className="gph-label" htmlFor={name}>{name === "password" ? "Mot de passe" : "Confirmation"}</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input id={name} name={name} type="password" autoComplete="new-password" minLength={8} required className="gph-input with-icon" />
          </div>
        </div>
      ))}
      {state?.error && <p role="alert" className="gph-badge danger justify-center whitespace-normal py-2.5 text-[13px]">{state.error}</p>}
      <button className="gph-btn-primary full mt-1" disabled={pending}>{pending ? "Enregistrement…" : "Valider et me connecter"}</button>
    </form>
  );
}
