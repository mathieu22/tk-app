// Primitives des écrans Réglages.
import type { ReactNode } from "react";
import { BackButton } from "@/components/ui";

export function SettingsHeader({ title, sub, back = "/reglages", action }: { title: string; sub?: ReactNode; back?: string; action?: ReactNode }) {
  return (
    <>
      <div className="flex items-center justify-between px-4 pb-1 pt-1.5">
        <BackButton href={back} />
        {action}
      </div>
      <div className="px-5 pb-3 pt-1">
        <h1 className="m-0 text-[26px] font-bold tracking-[-0.02em]">{title}</h1>
        {sub && <div className="mt-0.5 text-[13px] font-medium text-ink-3">{sub}</div>}
      </div>
    </>
  );
}

export function Field({ label, optional, error, hint, htmlFor, children }: {
  label: string; optional?: boolean; error?: string; hint?: string; htmlFor?: string; children: ReactNode;
}) {
  return (
    <div>
      <label className="gph-label" htmlFor={htmlFor}>
        {label} {optional && <span className="opt">(optionnel)</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-ink-3">{hint}</p>}
      {error && <p className="mt-1.5 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`gph-card p-4 ${className}`}>
      {title && <h2 className="m-0 mb-3 text-[15px] font-bold">{title}</h2>}
      {children}
    </section>
  );
}

/** Message de retour d'une action (succès / erreur). */
export function FormMessage({ state }: { state?: { ok?: string; error?: string } }) {
  if (!state?.ok && !state?.error) return null;
  return (
    <p role={state.error ? "alert" : "status"} className={`gph-badge ${state.error ? "danger" : "success"} w-full justify-center whitespace-normal py-2.5 text-[13px]`}>
      {state.error ?? state.ok}
    </p>
  );
}
