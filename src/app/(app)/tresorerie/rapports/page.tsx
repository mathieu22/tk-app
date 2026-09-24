import { Download, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TreasuryTabs } from "@/components/treasury-tabs";
import { FilterChips, ScreenHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { formatAriary, schoolMonths } from "@/lib/format";
import { accountBalances, incomeStatement } from "@/lib/treasury";
import { isoDay, reportPeriod } from "@/lib/treasury-filters";

export const metadata: Metadata = { title: "Bilans de trésorerie" };

const shift = (sy: string, n: number) => {
  const y = Number(sy.slice(0, 4)) + n;
  return `${y}-${y + 1}`;
};
const SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function StatementSection({ title, lines, total, color }: { title: string; lines: { name: string; amount: number }[]; total: number; color: string }) {
  return (
    <div className="gph-card p-0">
      <div className="flex items-baseline justify-between border-b border-divider px-4 py-3">
        <h2 className="text-[15px] font-bold">{title}</h2>
        <span className="gph-amount text-sm font-bold" style={{ color }}>{formatAriary(total)}</span>
      </div>
      {lines.length === 0 && <div className="px-4 py-3 text-sm text-ink-3">Aucune opération.</div>}
      {lines.map((l) => (
        <div key={l.name} className="flex items-baseline justify-between border-b border-divider px-4 py-2.5 text-sm last:border-0">
          <span>{l.name}</span>
          <span className="gph-amount">{formatAriary(l.amount)}</span>
        </div>
      ))}
    </div>
  );
}

export default async function ReportsPage(props: PageProps<"/tresorerie/rapports">) {
  const user = await requirePermission("treasury.view");
  const association = await getAssociation();
  const sp = await props.searchParams;
  const p = reportPeriod(sp, association.currentSchoolYear, association.schoolYearStartMon);
  const [statement, opening, closing, pending] = await Promise.all([
    incomeStatement(p.from, p.to),
    accountBalances({ until: p.from }),
    accountBalances({ until: p.to }),
    db.operation.count({ where: { status: "PENDING", cancelled: false } }),
  ]);
  const start = Number(p.annee.slice(0, 4));
  const months = schoolMonths(association.schoolYearStartMon).map((m) => {
    const y = m >= association.schoolYearStartMon ? start : start + 1;
    return { value: `${y}-${String(m).padStart(2, "0")}`, label: SHORT[m - 1] };
  });
  const qs = `annee=${p.annee}${p.mois ? `&mois=${p.mois}` : ""}`;
  const years = [shift(association.currentSchoolYear, -2), shift(association.currentSchoolYear, -1), association.currentSchoolYear];

  return (
    <>
      <ScreenHeader title="Bilans" sub={p.label} />
      <div className="px-4">
        <TreasuryTabs active="rapports" user={user} pending={pending} />
        <div className="mb-2.5">
          <FilterChips active={p.annee} hrefFor={(y) => `/tresorerie/rapports?annee=${y}`} options={years.map((y) => ({ value: y, label: y }))} />
        </div>
        <div className="mb-3.5">
          <FilterChips active={p.mois || "annee"} hrefFor={(v) => `/tresorerie/rapports?annee=${p.annee}${v === "annee" ? "" : `&mois=${v}`}`}
            options={[{ value: "annee", label: "Année" }, ...months]} />
        </div>

        <div className="mb-3.5 grid grid-cols-3 gap-2 text-center">
          <div className="gph-card p-3"><div className="text-[11px] font-semibold text-ink-3">Recettes</div><div className="gph-amount text-sm font-bold text-[var(--gph-success-ink)]">{formatAriary(statement.totalIncome)}</div></div>
          <div className="gph-card p-3"><div className="text-[11px] font-semibold text-ink-3">Dépenses</div><div className="gph-amount text-sm font-bold text-[var(--gph-danger-ink)]">{formatAriary(statement.totalExpense)}</div></div>
          <div className="gph-card p-3"><div className="text-[11px] font-semibold text-ink-3">Résultat</div><div className={`gph-amount text-sm font-bold ${statement.result < 0 ? "text-danger" : "text-primary"}`}>{formatAriary(statement.result)}</div></div>
        </div>

        <div className="mb-3.5 grid gap-3.5 md:grid-cols-2">
          <StatementSection title="Recettes" lines={statement.income} total={statement.totalIncome} color="var(--gph-success-ink)" />
          <StatementSection title="Dépenses" lines={statement.expense} total={statement.totalExpense} color="var(--gph-danger-ink)" />
        </div>

        <div className="gph-card mb-3.5 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-divider bg-bg text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">
              <tr><th className="px-4 py-2.5 text-left">Compte</th><th className="px-4 py-2.5 text-right">Début de période</th><th className="px-4 py-2.5 text-right">Fin de période</th></tr>
            </thead>
            <tbody>
              {closing.map((a) => (
                <tr key={a.id} className="border-b border-divider last:border-0">
                  <td className="px-4 py-2.5 font-semibold">{a.name}</td>
                  <td className="gph-amount px-4 py-2.5 text-right">{formatAriary(opening.find((o) => o.id === a.id)?.balance ?? 0)}</td>
                  <td className="gph-amount px-4 py-2.5 text-right font-bold">{formatAriary(a.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2">
          <a href={`/api/tresorerie/bilan?${qs}&format=pdf`} className="gph-btn-primary flex-1"><FileText size={16} /> Bilan PDF</a>
          <a href={`/api/tresorerie/bilan?${qs}&format=xlsx`} className="gph-btn-ghost flex-1"><Download size={16} /> Bilan Excel</a>
          <Link href={`/tresorerie/operations?du=${isoDay(p.from)}&au=${isoDay(new Date(p.to.getTime() - 86400e3))}`} className="gph-btn-ghost flex-1">Journal de la période</Link>
        </div>
        <p className="mt-3 text-xs text-ink-3">Compte de résultat simplifié : opérations validées et non annulées ; les virements internes n&apos;affectent pas le résultat.</p>
      </div>
    </>
  );
}
