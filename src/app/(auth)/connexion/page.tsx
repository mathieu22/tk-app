import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[linear-gradient(160deg,var(--gph-primary)_0%,var(--gph-primary-deep)_60%,#0a3010_100%)]">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[rgba(76,175,80,0.18)]" />
      <div className="relative px-6 pb-10 pt-20 text-white">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] opacity-65">TKDChoc · Gestion de Présence</div>
        <h1 className="mt-3 text-[32px] font-bold leading-tight tracking-[-0.03em]">Gestion TKDChoc</h1>
        <p className="mt-2 text-sm opacity-80">Présences, membres et cotisations.</p>
      </div>
      <div className="relative mx-auto w-full max-w-md flex-1 rounded-t-3xl bg-bg px-5 pb-10 pt-7 md:mb-16 md:flex-none md:rounded-3xl">
        <LoginForm />
      </div>
    </div>
  );
}
