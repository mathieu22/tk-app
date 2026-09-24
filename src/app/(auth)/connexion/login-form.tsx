"use client";
import { Lock, Phone } from "lucide-react";
import { useActionState, useState } from "react";
import { forgotPassword, login } from "@/app/actions/auth";

type Tab = "password" | "forgot";

export function LoginForm() {
  const [tab, setTab] = useState<Tab>("password");
  return (
    <div className="flex flex-col gap-4">
      <h2 className="m-0 text-xl font-bold">{tab === "forgot" ? "Mot de passe oublié" : "Connexion"}</h2>
      {tab === "password" && <PasswordForm onForgot={() => setTab("forgot")} />}
      {tab === "forgot" && <ForgotForm onBack={() => setTab("password")} />}
    </div>
  );
}

function Alert({ children, tone = "danger" }: { children: React.ReactNode; tone?: "danger" | "success" }) {
  return <p role="alert" className={`gph-badge ${tone} justify-center whitespace-normal py-2.5 text-center text-[13px]`}>{children}</p>;
}

function PasswordForm({ onForgot }: { onForgot: () => void }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <div>
        <label className="gph-label" htmlFor="phone">Téléphone ou email</label>
        <div className="relative">
          <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input id="phone" name="phone" type="text" inputMode="email" autoComplete="username" required
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
      {state?.error && <Alert>{state.error}</Alert>}
      <button className="gph-btn-primary full mt-1" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</button>
      <button type="button" onClick={onForgot} className="min-h-[44px] text-sm font-semibold text-primary">Mot de passe oublié ?</button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(forgotPassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <p className="text-sm text-ink-2">Saisissez votre téléphone ou votre email : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
      <div>
        <label className="gph-label" htmlFor="identifier">Téléphone ou email</label>
        <input id="identifier" name="identifier" required className="gph-input" placeholder="+261 34 12 345 67" />
      </div>
      {state?.done && <Alert tone="success">Si un compte correspond, un lien de réinitialisation a été envoyé.</Alert>}
      {state?.error && <Alert>{state.error}</Alert>}
      <button className="gph-btn-primary full mt-1" disabled={pending}>{pending ? "Envoi…" : "Envoyer le lien"}</button>
      <button type="button" onClick={onBack} className="min-h-[44px] text-sm font-semibold text-primary">Retour à la connexion</button>
    </form>
  );
}
