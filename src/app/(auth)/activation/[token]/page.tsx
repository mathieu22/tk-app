import type { Metadata } from "next";
import Link from "next/link";
import { checkAccessLink } from "@/lib/invitations";
import { ActivateForm } from "./activate-form";

export const metadata: Metadata = { title: "Activation du compte", robots: { index: false }, referrer: "no-referrer" };

export default async function ActivationPage(props: PageProps<"/activation/[token]">) {
  const { token } = await props.params;
  const link = await checkAccessLink(token);
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[linear-gradient(160deg,var(--gph-primary)_0%,var(--gph-primary-deep)_60%,#0a3010_100%)]">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[rgba(76,175,80,0.18)]" />
      <div className="relative px-6 pb-10 pt-20 text-white">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] opacity-65">GPH · Gestion de Présence</div>
        <h1 className="mt-3 text-[32px] font-bold leading-tight tracking-[-0.03em]">
          {link?.kind === "RESET" ? "Nouveau mot de passe" : "Bienvenue au club"}
        </h1>
      </div>
      <div className="relative mx-auto w-full max-w-md flex-1 rounded-t-3xl bg-bg px-5 pb-10 pt-7 md:mb-16 md:flex-none md:rounded-3xl">
        {link ? (
          <ActivateForm token={token} reset={link.kind === "RESET"} />
        ) : (
          <div className="flex flex-col gap-4">
            <h2 className="m-0 text-xl font-bold">Lien expiré</h2>
            <p className="text-sm text-ink-2">Ce lien n&apos;est plus valide ou a déjà été utilisé. Demandez au club de vous renvoyer une invitation, ou utilisez « Mot de passe oublié ».</p>
            <Link href="/connexion" className="gph-btn-primary full">Aller à la connexion</Link>
          </div>
        )}
      </div>
    </div>
  );
}
