"use client";
// Navigation : barre d'onglets en bas (mobile), barre latérale (≥ md). Spec §3.
import {
  Award, Bell, CalendarCheck2, CalendarDays, HeartHandshake, Home, Landmark, LayoutGrid, Settings, Trophy, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

const ICONS: Record<string, LucideIcon> = {
  "calendar-check-2": CalendarCheck2, users: Users, wallet: Wallet, "calendar-days": CalendarDays, award: Award,
  trophy: Trophy, landmark: Landmark, "heart-handshake": HeartHandshake, settings: Settings, "layout-grid": LayoutGrid,
  home: Home, bell: Bell,
};
export const navIcon = (name: string) => ICONS[name] ?? LayoutGrid;

const MORE: NavItem = { href: "/plus", label: "Plus", icon: "layout-grid" };

export function BottomNav({ primary, secondary }: { primary: NavItem[]; secondary: NavItem[] }) {
  const path = usePathname();
  const items = secondary.length ? [...primary, MORE] : primary;
  // L'onglet « Plus » reste actif dans les modules secondaires.
  const activeHref =
    items.find((i) => path.startsWith(i.href))?.href ?? (secondary.some((s) => path.startsWith(s.href)) ? MORE.href : "");
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 grid border-t border-divider bg-white pb-[max(12px,env(safe-area-inset-bottom))] pt-1.5 md:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
    >
      {items.map(({ href, label, icon }) => {
        const active = href === activeHref;
        const Icon = navIcon(icon);
        return (
          <Link key={href} href={href}
            className={`flex flex-col items-center gap-[3px] pb-1 pt-2 text-[11px] font-semibold ${active ? "text-primary" : "text-ink-3"}`}>
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

export function SideNav({ primary, secondary, footer }: { primary: NavItem[]; secondary: NavItem[]; footer?: React.ReactNode }) {
  const path = usePathname();
  const link = ({ href, label, icon }: NavItem) => {
    const active = path.startsWith(href);
    const Icon = navIcon(icon);
    return (
      <Link key={href} href={href}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-bg"}`}>
        <Icon size={20} strokeWidth={2.2} />
        {label}
      </Link>
    );
  };
  return (
    <aside className="sticky top-0 hidden h-screen w-60 flex-none flex-col gap-1 overflow-y-auto border-r border-divider bg-white p-4 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2 pt-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">GPH</span>
        <span className="text-sm font-bold leading-tight">Gestion de<br />Présence</span>
      </div>
      {primary.map(link)}
      {secondary.length > 0 && <div className="mx-3 my-3 h-px bg-divider" />}
      {secondary.map(link)}
      <div className="mt-auto">{footer}</div>
    </aside>
  );
}
