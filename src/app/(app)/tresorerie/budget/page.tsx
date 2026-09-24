import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import { BudgetForm } from "@/components/treasury-budget-form";
import { TreasuryTabs } from "@/components/treasury-tabs";
import { FilterChips, ProgressBar, ScreenHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { formatAriary } from "@/lib/format";
import { can } from "@/lib/permissions";
import { budgetComparison } from "@/lib/treasury";

export const metadata: Metadata = { title: "Budget prévisionnel" };

const shift = (sy: string, n: number) => {
  const y = Number(sy.slice(0, 4)) + n;
  return `${y}-${y + 1}`;
};

export default async function BudgetPage(props: PageProps<"/tresorerie/budget">) {
  const user = await requirePermission("treasury.view");
  const association = await getAssociation();
  const sp = await props.searchParams;
  const current = association.currentSchoolYear;
  const years = [shift(current, -1), current, shift(current, 1)];
  const schoolYear = years.includes(String(sp.annee)) ? String(sp.annee) : current;
  const [lines, pending] = await Promise.all([
    budgetComparison(schoolYear, association.schoolYearStartMon),
    db.operation.count({ where: { status: "PENDING", cancelled: false } }),
  ]);
  const manage = can(user, "treasury.manage");
  const overs = lines.filter((l) => l.over);

  const body = (["INCOME", "EXPENSE"] as const).map((type) => {
    const rows = lines.filter((l) => l.category.type === type);
    const planned = rows.reduce((s, l) => s + l.planned, 0);
    const actual = rows.reduce((s, l) => s + l.actual, 0);
    return (
      <section key={type} className="mb-4">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-[15px] font-bold">{type === "INCOME" ? "Recettes" : "Dépenses"}</h2>
          <span className="gph-amount text-xs font-semibold text-ink-3">{formatAriary(actual)} / {formatAriary(planned)}</span>
        </div>
        <div className="gph-card divide-y divide-[var(--gph-divider)] p-0">
          {rows.map((l) => {
            const tone = l.over ? "danger" : l.pct !== null && l.pct >= 90 && type === "EXPENSE" ? "warning" : "success";
            return (
              <div key={l.category.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-3.5 py-3 md:grid-cols-[1fr_160px_1fr_auto]">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  {l.over && <AlertTriangle size={14} className="text-danger" aria-label="Dépassement" />}
                  {l.category.name}
                </span>
                {manage ? (
                  <input name={`budget_${l.category.id}`} inputMode="numeric" defaultValue={l.planned || ""} placeholder="0"
                    aria-label={`Budget ${l.category.name}`} className="gph-input gph-amount !w-36 !py-2 text-right text-sm md:!w-40" />
                ) : (
                  <span className="gph-amount text-right text-sm">{formatAriary(l.planned)}</span>
                )}
                <div className="col-span-2 flex items-center gap-2 md:col-span-1">
                  <ProgressBar pct={l.pct ?? (l.actual ? 100 : 0)} tone={l.planned ? tone : undefined} color={l.planned ? undefined : "var(--gph-ink-3)"} />
                </div>
                <span className={`gph-amount col-span-2 text-right text-xs font-semibold md:col-span-1 ${l.over ? "text-danger" : "text-ink-2"}`}>
                  {formatAriary(l.actual)}{l.pct !== null && ` · ${l.pct} %`}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    );
  });

  return (
    <>
      <ScreenHeader title="Budget" sub={`Prévu / réalisé · ${schoolYear}`} />
      <div className="px-4">
        <TreasuryTabs active="budget" user={user} pending={pending} />
        <div className="mb-3.5">
          <FilterChips active={schoolYear} hrefFor={(y) => `/tresorerie/budget?annee=${y}`} options={years.map((y) => ({ value: y, label: y }))} />
        </div>
        {overs.length > 0 && (
          <div role="alert" className="gph-card mb-3.5 flex items-start gap-2.5 border-[var(--gph-danger)] bg-[var(--gph-danger-soft)] p-3.5 text-sm font-semibold text-[var(--gph-danger-ink)]">
            <AlertTriangle size={18} className="mt-px flex-none" />
            Dépassement : {overs.map((o) => `${o.category.name} (+${formatAriary(o.actual - o.planned)})`).join(", ")}
          </div>
        )}
        {manage ? <BudgetForm schoolYear={schoolYear}>{body}</BudgetForm> : body}
      </div>
    </>
  );
}
