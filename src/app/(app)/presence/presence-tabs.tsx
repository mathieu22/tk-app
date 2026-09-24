// Sous-onglets du module Présence (spec §3.1) : Séances | Événements.
import Link from "next/link";

export function PresenceTabs({ active }: { active: "seances" | "evenements" }) {
  const tabs = [
    { key: "seances", label: "Séances", href: "/presence" },
    { key: "evenements", label: "Événements", href: "/presence/evenements" },
  ] as const;
  return (
    <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-track p-1 md:max-w-sm" role="tablist">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} role="tab" aria-selected={active === t.key}
          className={`rounded-lg py-2 text-center text-[13px] font-bold ${active === t.key ? "bg-white text-primary shadow-sm" : "text-ink-3"}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
