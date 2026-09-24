import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { BackButton, FilterChips, StatTile } from "@/components/ui";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { FEE_META, fullName, type DueStatus } from "@/lib/domain";
import { calendarYear, ensureDues } from "@/lib/fees";
import { formatAriary, schoolMonths } from "@/lib/format";
import { can } from "@/lib/permissions";
import { CenterSelected } from "../center-selected";
import { aggregateStatus, availableSchoolYears, isFutureMonth, referenceMonth, stats, tariffFor } from "../data";
import { MONTH_SHORT } from "../months";
import { EmptyList, StatusRow } from "../status-row";

export const metadata: Metadata = { title: "Écolage" };

const META = FEE_META.ECOLAGE;
const FILTERS: { value: string; label: string; status?: DueStatus }[] = [
  { value: "tous", label: "Tous" },
  { value: "payes", label: "Payés", status: "PAID" },
  { value: "partiels", label: "Partiels", status: "PARTIAL" },
  { value: "non-payes", label: "Non payés", status: "UNPAID" },
];
const DOT: Record<DueStatus | "NONE", string> = {
  PAID: "var(--gph-success)",
  PARTIAL: "var(--gph-warning)",
  UNPAID: "var(--gph-danger)",
  NONE: "var(--gph-divider)",
};

export default async function EcolageDetail({ searchParams }: PageProps<"/cotisations/ecolage">) {
  const user = await requirePermission("payment.viewAll");
  const association = await getAssociation();
  const currentSY = association.currentSchoolYear;
  await ensureDues(currentSY);

  const sp = await searchParams;
  const years = await availableSchoolYears(currentSY);
  const year = typeof sp.annee === "string" && years.includes(sp.annee) ? sp.annee : currentSY;
  const monthParam = Number(sp.mois);
  const month = monthParam >= 1 && monthParam <= 12 ? monthParam : referenceMonth(year, currentSY);
  const filter = FILTERS.find((f) => f.value === sp.statut) ?? FILTERS[0];
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const [amount, dues] = await Promise.all([
    tariffFor("ECOLAGE", year),
    db.due.findMany({
      where: { feeType: { code: "ECOLAGE" }, schoolYear: year, member: { archived: false } },
      select: {
        month: true, status: true, amountDue: true, amountPaid: true,
        member: { select: { id: true, firstName: true, lastName: true, phone: true, photoUrl: true } },
      },
      orderBy: [{ member: { lastName: "asc" } }, { member: { firstName: "asc" } }],
    }),
  ]);

  const monthDues = dues.filter((d) => d.month === month);
  const s = stats(monthDues);
  const needle = q.toLowerCase();
  const rows = monthDues.filter(
    (d) =>
      (!filter.status || d.status === filter.status) &&
      (!needle || fullName(d.member).toLowerCase().includes(needle) || (d.member.phone ?? "").includes(needle.replace(/\s/g, ""))),
  );

  const canPay = can(user, "payment.create");
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ annee: year, mois: String(month), statut: filter.value, ...(q && { q }), ...patch });
    return `/cotisations/ecolage?${p}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-1.5">
        <BackButton href={`/cotisations?annee=${year}`} />
      </div>

      <div className="px-5 pb-3 pt-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: META.soft, color: META.color }}>
            <Icon name={META.icon} size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Écolage</h1>
            <div className="mt-0.5 text-xs font-semibold text-ink-3">
              {META.sublabel} · <span className="gph-amount">{formatAriary(amount)}</span>/mois · {year}
            </div>
          </div>
        </div>
      </div>

      {/* Carrousel des mois (septembre → août) */}
      <div className="px-1 pb-2.5">
        <CenterSelected className="no-scrollbar flex gap-1.5 overflow-x-auto px-3">
          {schoolMonths().map((m) => {
            const selected = m === month;
            const agg = aggregateStatus(dues.filter((d) => d.month === m), isFutureMonth(m, year, currentSY));
            return (
              <Link
                key={m}
                href={qs({ mois: String(m) })}
                replace
                scroll={false}
                data-selected={selected || undefined}
                aria-current={selected ? "true" : undefined}
                className="min-w-[54px] flex-none rounded-[10px] px-1.5 py-2 text-center"
                style={{
                  background: selected ? META.color : "#fff",
                  color: selected ? "#fff" : "var(--gph-ink)",
                  border: selected ? "none" : "1px solid var(--gph-divider)",
                  boxShadow: selected ? "0 6px 14px rgba(0,105,92,0.25)" : "none",
                }}
              >
                <div className="text-xs font-bold">{MONTH_SHORT[m]}</div>
                <div className="mx-auto mt-1.5 h-1.5 w-1.5 rounded-full" style={{ background: selected ? "rgba(255,255,255,0.7)" : DOT[agg] }} />
              </Link>
            );
          })}
        </CenterSelected>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 pb-2.5">
        <StatTile value={s.paid} label="Payés" color="var(--gph-success)" />
        <StatTile value={s.partial} label="Partiels" color="var(--gph-warning)" />
        <StatTile value={s.unpaid} label="Non payés" color="var(--gph-danger)" />
      </div>

      <div className="flex items-baseline justify-between px-5 pb-2.5 text-xs font-semibold text-ink-3">
        <span>
          {MONTH_SHORT[month]} {calendarYear(year, month)}
        </span>
        <span>
          <span className="gph-amount font-bold" style={{ color: META.color }}>{formatAriary(s.collected)}</span>
          {" / "}
          <span className="gph-amount">{formatAriary(s.expected)}</span>
        </span>
      </div>

      <form action="/cotisations/ecolage" className="px-4 pb-2.5">
        <input type="hidden" name="annee" value={year} />
        <input type="hidden" name="mois" value={month} />
        <input type="hidden" name="statut" value={filter.value} />
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input name="q" type="search" defaultValue={q} placeholder="Rechercher un membre" className="gph-input with-icon" />
        </div>
      </form>

      <div className="px-4 pb-2.5">
        <FilterChips
          options={FILTERS.map((f) => ({
            value: f.value,
            label: f.label,
            count: f.status ? monthDues.filter((d) => d.status === f.status).length : monthDues.length,
          }))}
          active={filter.value}
          hrefFor={(v) => qs({ statut: v })}
        />
      </div>

      <div className="flex flex-col gap-2 px-4 pb-4 lg:grid lg:grid-cols-2">
        {rows.length === 0 && <EmptyList>Aucun membre pour ce filtre.</EmptyList>}
        {rows.map((d) => (
          <StatusRow
            key={d.member.id}
            name={fullName(d.member)}
            photoUrl={d.member.photoUrl}
            status={d.status as DueStatus}
            detail={
              d.status === "PAID"
                ? formatAriary(d.amountPaid)
                : d.status === "PARTIAL"
                  ? `${formatAriary(d.amountPaid)} / ${formatAriary(d.amountDue)}`
                  : d.amountDue !== amount ? `Tarif du groupe : ${formatAriary(d.amountDue)}` : "—"
            }
            href={
              canPay && d.status !== "PAID"
                ? `/cotisations/paiement?membre=${d.member.id}&type=ecolage&annee=${year}&mois=${month}`
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
