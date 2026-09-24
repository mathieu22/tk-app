"use client";
// Ligne de notification : l'ouvrir la marque comme lue.
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markNotificationRead } from "@/app/actions/espace";

export function EspaceNotificationLink({ id, href, unread, children }: { id: string; href: string | null; unread: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const [, start] = useTransition();
  // N'accepte que les liens internes (pas de redirection ouverte)
  const target = href && href.startsWith("/") && !href.startsWith("//") ? href : null;
  return (
    <button type="button" className="gph-card flex w-full items-start gap-3 p-3 text-left"
      onClick={() => start(async () => {
        if (unread) await markNotificationRead(id);
        if (target) router.push(target);
      })}>
      {children}
    </button>
  );
}
