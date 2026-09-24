"use client";
// Navigation de l'espace parent / athlète : onglets en bas (mobile), barre latérale (ordinateur).
import { Bell, CalendarDays, Home, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const ITEMS: { href: string; label: string; Icon: LucideIcon; exact?: boolean }[] = [
  { href: "/mon-espace", label: "Accueil", Icon: Home, exact: true },
  { href: "/mon-espace/calendrier", label: "Calendrier", Icon: CalendarDays },
  { href: "/mon-espace/notifications", label: "Notifications", Icon: Bell },
  { href: "/mon-espace/profil", label: "Profil", Icon: UserRound },
];

function useActive() {
  const path = usePathname();
  const child = useSearchParams().get("enfant");
  const isActive = (href: string, exact?: boolean) =>
    exact ? path === href || path.startsWith("/mon-espace/evenements") : path.startsWith(href);
  // Conserve l'enfant sélectionné d'un écran à l'autre
  const withChild = (href: string) => (child ? `${href}?enfant=${encodeURIComponent(child)}` : href);
  return { isActive, withChild };
}

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[18px] text-white">
      {n > 9 ? "9+" : n}
    </span>
  );
}

export function EspaceBottomNav({ unread }: { unread: number }) {
  const { isActive, withChild } = useActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-divider bg-card pb-[max(12px,env(safe-area-inset-bottom))] pt-1.5 md:hidden">
      {ITEMS.map(({ href, label, Icon, exact }) => {
        const active = isActive(href, exact);
        return (
          <Link key={href} href={withChild(href)}
            className={`flex flex-col items-center gap-[3px] pb-1 pt-2 text-[11px] font-semibold ${active ? "text-primary" : "text-ink-3"}`}>
            <span className={`relative flex h-7 w-14 items-center justify-center rounded-full ${active ? "bg-primary-soft" : ""}`}>
              <Icon size={20} strokeWidth={2.2} />
              {href.endsWith("notifications") && <Badge n={unread} />}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function EspaceSideNav({ unread, footer }: { unread: number; footer?: React.ReactNode }) {
  const { isActive, withChild } = useActive();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 flex-none flex-col gap-1 border-r border-divider bg-card p-4 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2 pt-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">TK</span>
        <span className="text-sm font-bold leading-tight">Mon espace</span>
      </div>
      {ITEMS.map(({ href, label, Icon, exact }) => (
        <Link key={href} href={withChild(href)}
          className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive(href, exact) ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-bg"}`}>
          <Icon size={20} strokeWidth={2.2} />
          {label}
          {href.endsWith("notifications") && unread > 0 && (
            <span className="ml-auto rounded-full bg-danger px-2 text-[11px] font-bold leading-5 text-white">{unread}</span>
          )}
        </Link>
      ))}
      <div className="mt-auto">{footer}</div>
    </aside>
  );
}
