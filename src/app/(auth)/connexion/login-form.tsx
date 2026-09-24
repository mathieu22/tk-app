"use client";
import { KeyRound, Lock, MessageSquareText, Phone } from "lucide-react";
import { useActionState, useState } from "react";
import { forgotPassword, login, requestCode, verifyCode, type CodeState } from "@/app/actions/auth";

type Tab = "password" | "code" | "forgot";

export function LoginForm() {
  const [tab, setTab] = useState<Tab>("password");
  return (
    <div className="flex flex-col gap-4">
      <h2 className="m-0 text-xl font-bold">{tab === "forgot" ? "Mot de passe oublié" : "Connexion"}</h2>
      {tab !== "forgot" && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-track p-1" role="tablist">
          {([["password", "Mot de passe", Lock], ["code", "Code SMS", MessageSquareText]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold ${tab === id ? "bg-white text-primary shadow-sm" : "text-ink-2"}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      )}
      {tab === "password" && <PasswordForm onForgot={() => setTab("forgot")} />}
      {tab === "code" && <CodeForm />}
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

function CodeForm() {
  const [state, action, pending] = useActionState(
    (prev: CodeState, fd: FormData) => (fd.get("intent") === "verify" ? verifyCode(prev, fd) : requestCode(prev, fd)),
    { step: "phone" } as CodeState,
  );
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <div>
        <label className="gph-label" htmlFor="code-phone">Téléphone</label>
        <div className="relative">
          <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input id="code-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required readOnly={state.step === "code"}
            placeholder="+261 34 12 345 67" defaultValue={state.phone} key={state.phone} className="gph-input with-icon" />
        </div>
      </div>
      {state.step === "code" && (
        <div>
          <label className="gph-label" htmlFor="code">Code reçu par SMS</label>
          <div className="relative">
            <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required autoFocus
              className="gph-input with-icon gph-amount tracking-[0.3em]" />
          </div>
        </div>
      )}
      {state.info && <Alert tone="success">{state.info}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      {state.step === "phone" ? (
        <button name="intent" value="request" className="gph-btn-primary full mt-1" disabled={pending}>
          {pending ? "Envoi…" : "Recevoir un code"}
        </button>
      ) : (
        <>
          <button name="intent" value="verify" className="gph-btn-primary full mt-1" disabled={pending}>
            {pending ? "Vérification…" : "Se connecter"}
          </button>
          <button name="intent" value="request" formNoValidate className="min-h-[44px] text-sm font-semibold text-primary" disabled={pending}>
            Renvoyer un code
          </button>
        </>
      )}
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
