// Sous-navigation du module Trésorerie.
import Link from "next/link";
import type { CurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";

export function TreasuryTabs({ active, user, pending = 0 }: { active: string; user: CurrentUser; pending?: number }) {
  const tabs = [
    { href: "/tresorerie", key: "dashboard", label: "Tableau de bord" },
    { href: "/tresorerie/operations", key: "journal", label: "Journal" },
    { href: "/tresorerie/comptes", key: "comptes", label: "Comptes" },
    { href: "/tresorerie/budget", key: "budget", label: "Budget" },
    { href: "/tresorerie/rapports", key: "rapports", label: "Bilans" },
    ...(can(user, "expense.approve") || pending
      ? [{ href: "/tresorerie/a-valider", key: "valider", label: "À valider", count: pending }]
      : []),
    ...(can(user, "treasury.manage")
      ? [
          { href: "/tresorerie/categories", key: "categories", label: "Catégories" },
          { href: "/tresorerie/rapprochement", key: "rapprochement", label: "Rapprochement" },
        ]
      : []),
  ];
  return (
    <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={`gph-chip${t.key === active ? " active" : ""}`}>
          {t.label}
          {"count" in t && t.count ? <span className="count">{t.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}
