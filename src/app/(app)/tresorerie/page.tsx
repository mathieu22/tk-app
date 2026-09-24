import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TreasuryChart } from "@/components/treasury-chart";
import { OPERATION_INCLUDE, OperationList } from "@/components/treasury-operations";
import { TreasuryTabs } from "@/components/treasury-tabs";
import { ScreenHeader, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { formatAriary, MONTH_LABELS } from "@/lib/format";
import { can } from "@/lib/permissions";
import { accountBalances, ACCOUNT_TYPES, COUNTED, monthlySeries, monthRange } from "@/lib/treasury";

export const metadata: Metadata = { title: "Trésorerie" };

export default async function TreasuryPage() {
  const user = await requirePermission("treasury.view");
  const association = await getAssociation();
  const now = new Date();
  const [from, to] = monthRange(now.getFullYear(), now.getMonth() + 1);

  const [balances, series, monthOps, pending, recent] = await Promise.all([
    accountBalances(),
    monthlySeries(association.currentSchoolYear, association.schoolYearStartMon),
    db.operation.groupBy({ by: ["type"], where: { ...COUNTED, date: { gte: from, lt: to } }, _sum: { amount: true } }),
    db.operation.count({ where: { status: "PENDING", cancelled: false } }),
    db.operation.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 6, include: OPERATION_INCLUDE }),
  ]);
  const total = balances.reduce((s, a) => s + a.balance, 0);
  const monthIn = monthOps.find((o) => o.type === "INCOME")?._sum.amount ?? 0;
  const monthOut = monthOps.find((o) => o.type === "EXPENSE")?._sum.amount ?? 0;
  const manage = can(user, "treasury.manage");

  return (
    <>
      <ScreenHeader title="Trésorerie" sub={`${MONTH_LABELS[now.getMonth()]} ${now.getFullYear()} · ${association.currentSchoolYear}`} />
      <div className="px-4">
        <TreasuryTabs active="dashboard" user={user} pending={pending} />

        <div className="grid gap-3.5 lg:grid-cols-[1.2fr_1fr]">
          <div className="gph-card relative overflow-hidden border-none bg-[linear-gradient(160deg,#0D47A1_0%,#1B5E20_100%)] p-4 text-white">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/8" />
            <div className="relative">
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] opacity-75">Solde total</div>
              <div className="gph-amount mt-0.5 text-[28px] font-bold leading-tight">{formatAriary(total)}</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.04em] opacity-75">Recettes du mois</div>
                  <div className="gph-amount font-bold">+{formatAriary(monthIn)}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.04em] opacity-75">Dépenses du mois</div>
                  <div className="gph-amount font-bold">−{formatAriary(monthOut)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="gph-card overflow-hidden p-0">
            {balances.map((a, i) => (
              <Link key={a.id} href={`/tresorerie/operations?compte=${a.id}`}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-bg ${i ? "border-t border-divider" : ""}`}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{a.name}</span>
                  <span className="block text-[11px] font-medium text-ink-3">{ACCOUNT_TYPES[a.type as keyof typeof ACCOUNT_TYPES] ?? a.type}</span>
                </span>
                <span className={`gph-amount whitespace-nowrap text-sm font-bold ${a.balance < 0 ? "text-danger" : ""}`}>{formatAriary(a.balance)}</span>
              </Link>
            ))}
          </div>
        </div>

        {pending > 0 && (
          <Link href="/tresorerie/a-valider" className="gph-card mt-3.5 flex items-center gap-3 border-[var(--gph-warning)] bg-[var(--gph-warning-soft)] p-3.5">
            <Clock size={18} className="text-[var(--gph-warning-ink)]" />
            <span className="flex-1 text-sm font-semibold text-[var(--gph-warning-ink)]">
              {pending} dépense{pending > 1 ? "s" : ""} en attente de validation
            </span>
          </Link>
        )}

        {manage && (
          <div className="mt-3.5 grid grid-cols-3 gap-2">
            {[
              { type: "INCOME", label: "Recette", Icon: ArrowDownLeft, color: "var(--gph-success-ink)" },
              { type: "EXPENSE", label: "Dépense", Icon: ArrowUpRight, color: "var(--gph-danger-ink)" },
              { type: "TRANSFER", label: "Virement", Icon: ArrowLeftRight, color: "var(--gph-finance)" },
            ].map(({ type, label, Icon, color }) => (
              <Link key={type} href={`/tresorerie/nouvelle?type=${type}`} className="gph-card flex flex-col items-center gap-1.5 px-2 py-3 text-xs font-bold">
                <Icon size={20} style={{ color }} strokeWidth={2.4} />
                {label}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-5">
          <SectionTitle link={{ href: "/tresorerie/rapports", label: "Bilans" }}>Évolution {association.currentSchoolYear}</SectionTitle>
          <div className="gph-card p-3">
            <TreasuryChart data={series} />
          </div>
        </div>

        <div className="mt-5">
          <SectionTitle link={{ href: "/tresorerie/operations", label: "Journal" }}>Dernières opérations</SectionTitle>
          <OperationList ops={recent} empty="Aucune opération enregistrée." />
        </div>
      </div>
    </>
  );
}
