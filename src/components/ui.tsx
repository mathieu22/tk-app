// Primitives d'écran du design (en-têtes, barres de progression, filtres).
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Tone } from "@/lib/domain";

export function ScreenHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-3.5">
      <div className="min-w-0">
        <h1 className="m-0 text-[28px] font-bold leading-[1.15] tracking-[-0.02em]">{title}</h1>
        {sub && <div className="mt-0.5 text-[13px] font-medium text-ink-3">{sub}</div>}
      </div>
      {action}
    </header>
  );
}

export function BackButton({ href, label = "Retour" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="gph-icon-btn" aria-label={label}>
      <ChevronLeft size={18} />
    </Link>
  );
}

/** Barre « Annuler — Titre — Action » des formulaires. */
export function FormTopBar({ cancelHref, title, action }: { cancelHref: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pb-3.5 pt-2">
      <Link href={cancelHref} className="flex min-w-[60px] items-center gap-1">
        <ChevronLeft size={20} />
        <span className="text-[15px] font-semibold text-primary">Annuler</span>
      </Link>
      <div className="text-base font-bold">{title}</div>
      <div className="flex min-w-[60px] justify-end">{action}</div>
    </div>
  );
}

export function SectionTitle({ children, link }: { children: ReactNode; link?: { href: string; label: string } }) {
  return (
    <div className="flex items-baseline justify-between px-1 pb-2.5 pt-1">
      <h2 className="m-0 text-[15px] font-bold">{children}</h2>
      {link && (
        <Link href={link.href} className="flex-none whitespace-nowrap text-xs font-semibold text-primary">
          {link.label}
        </Link>
      )}
    </div>
  );
}

const TONE_BG: Record<Tone, string> = {
  success: "var(--gph-success)",
  warning: "var(--gph-warning)",
  danger: "var(--gph-danger)",
};

export function ProgressBar({ pct, tone, color, height = 6, track = "var(--gph-track)" }: {
  pct: number; tone?: Tone; color?: string; height?: number; track?: string;
}) {
  return (
    <div className="flex-1 overflow-hidden rounded-full" style={{ height, background: track }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color ?? (tone ? TONE_BG[tone] : "var(--gph-primary)") }}
      />
    </div>
  );
}

/** Filtres en pastilles, pilotés par l'URL (?param=valeur) pour rester côté serveur. */
export function FilterChips({ options, active, hrefFor }: {
  options: { value: string; label: string; count?: number }[];
  active: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      {options.map((o) => (
        <Link key={o.value} href={hrefFor(o.value)} scroll={false} replace className={`gph-chip${o.value === active ? " active" : ""}`}>
          {o.label}
          {o.count !== undefined && <span className="count">{o.count}</span>}
        </Link>
      ))}
    </div>
  );
}

export function StatTile({ value, label, color }: { value: ReactNode; label: string; color?: string }) {
  return (
    <div className="gph-card px-2.5 py-3 text-center">
      <div className="text-2xl font-bold tracking-[-0.02em]" style={{ color }}>{value}</div>
      <div className="mt-px text-[11px] font-semibold text-ink-3">{label}</div>
    </div>
  );
}
