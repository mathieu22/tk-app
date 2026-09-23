"use client";
// Navigation principale : barre d'onglets en bas (mobile), barre latérale (≥ md). Spec §3.1.
import { CalendarCheck2, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/presence", label: "Présence", Icon: CalendarCheck2 },
  { href: "/membres", label: "Membres", Icon: Users },
  { href: "/cotisations", label: "Cotisations", Icon: Wallet },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-divider bg-white pb-[max(12px,env(safe-area-inset-bottom))] pt-1.5 md:hidden">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-[3px] pb-1 pt-2 text-[11px] font-semibold ${active ? "text-primary" : "text-ink-3"}`}
          >
            <span className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors ${active ? "bg-primary-soft" : ""}`}>
              <Icon size={20} strokeWidth={2.2} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SideNav() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 flex-none flex-col gap-1 border-r border-divider bg-white p-4 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2 pt-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">GPH</span>
        <span className="text-sm font-bold leading-tight">Gestion de<br />Présence</span>
      </div>
      {ITEMS.map(({ href, label, Icon }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-bg"}`}
          >
            <Icon size={20} strokeWidth={2.2} />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
