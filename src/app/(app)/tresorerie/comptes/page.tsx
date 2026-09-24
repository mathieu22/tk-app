import { Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ToggleAccountButton } from "@/components/treasury-account-form";
import { TreasuryTabs } from "@/components/treasury-tabs";
import { ScreenHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { OPERATORS } from "@/lib/domain";
import { formatAriary } from "@/lib/format";
import { can } from "@/lib/permissions";
import { accountBalances, ACCOUNT_TYPES } from "@/lib/treasury";

export const metadata: Metadata = { title: "Comptes de trésorerie" };

export default async function AccountsPage() {
  const user = await requirePermission("treasury.view");
  const [accounts, pending] = await Promise.all([
    accountBalances({ includeInactive: true }),
    db.operation.count({ where: { status: "PENDING", cancelled: false } }),
  ]);
  const manage = can(user, "treasury.manage");
  const total = accounts.filter((a) => a.active).reduce((s, a) => s + a.balance, 0);

  return (
    <>
      <ScreenHeader title="Comptes" sub={<>Solde total <span className="gph-amount font-bold">{formatAriary(total)}</span></>}
        action={manage && <Link href="/tresorerie/comptes/nouveau" className="gph-btn-primary"><Plus size={16} strokeWidth={2.5} /> Compte</Link>} />
      <div className="px-4">
        <TreasuryTabs active="comptes" user={user} pending={pending} />
        <div className="grid gap-2.5 md:grid-cols-2">
          {accounts.map((a) => (
            <div key={a.id} className={`gph-card p-3.5 ${a.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold">{a.name}</div>
                  <div className="text-xs font-medium text-ink-3">
                    {ACCOUNT_TYPES[a.type as keyof typeof ACCOUNT_TYPES] ?? a.type}
                    {a.operator && ` · ${OPERATORS[a.operator as keyof typeof OPERATORS] ?? a.operator}`}
                    {!a.active && " · désactivé"}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`gph-amount text-lg font-bold ${a.balance < 0 ? "text-danger" : ""}`}>{formatAriary(a.balance)}</div>
                  <div className="gph-amount text-[11px] text-ink-3">départ {formatAriary(a.openingBalance)}</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link href={`/tresorerie/operations?compte=${a.id}`} className="gph-btn-ghost !min-h-9 flex-1 !py-1.5 text-xs">Mouvements</Link>
                {manage && (
                  <>
                    <Link href={`/tresorerie/comptes/${a.id}`} className="gph-btn-ghost !min-h-9 !px-3 !py-1.5 text-xs" aria-label="Modifier"><Pencil size={14} /></Link>
                    <ToggleAccountButton id={a.id} active={a.active} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-3">
          Solde en temps réel = solde de départ + recettes − dépenses ± virements (hors opérations annulées, rejetées ou en attente de validation).
        </p>
      </div>
    </>
  );
}
