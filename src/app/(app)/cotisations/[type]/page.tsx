import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icon";
import { BackButton, FilterChips, ProgressBar } from "@/components/ui";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { FEE_BY_SLUG, FEE_META, fullName, type DueStatus } from "@/lib/domain";
import { ensureDues } from "@/lib/fees";
import { formatAriary, formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { previousSchoolYear, stats, tariffFor } from "../data";
import { EmptyList, StatusRow } from "../status-row";

const FILTERS: { value: string; label: string; status?: DueStatus }[] = [
  { value: "tous", label: "Tous" },
  { value: "payes", label: "Payés", status: "PAID" },
  { value: "partiels", label: "Partiels", status: "PARTIAL" },
  { value: "non-payes", label: "Non payés", status: "UNPAID" },
];

/** Droit et Passport uniquement : l'Écolage a sa route dédiée (/cotisations/ecolage). */
function annualCode(slug: string) {
  const code = FEE_BY_SLUG[slug];
  return code === "DROIT" || code === "PASSPORT" ? code : null;
}

export async function generateMetadata({ params }: PageProps<"/cotisations/[type]">): Promise<Metadata> {
  const code = annualCode((await params).type);
  return { title: code === "DROIT" ? "Droit" : code === "PASSPORT" ? "Passport" : "Cotisations" };
}

export default async function AnnualDetail({ params, searchParams }: PageProps<"/cotisations/[type]">) {
  const code = annualCode((await params).type);
  if (!code) notFound();
  const user = await requirePermission("payment.viewAll");
  const association = await getAssociation();
  const currentSY = association.currentSchoolYear;
  await ensureDues(currentSY);

  const sp = await searchParams;
  const years = [previousSchoolYear(currentSY), currentSY];
  const year = typeof sp.annee === "string" && years.includes(sp.annee) ? sp.annee : currentSY;
  const filter = FILTERS.find((f) => f.value === sp.statut) ?? FILTERS[0];
  const meta = FEE_META[code];

  const [feeType, amount, dues] = await Promise.all([
    db.feeType.findUniqueOrThrow({ where: { code } }),
    tariffFor(code, year),
    db.due.findMany({
      where: { feeType: { code }, schoolYear: year, month: 0, member: { archived: false } },
      select: {
        status: true, amountDue: true, amountPaid: true,
        member: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
        allocations: {
          where: { payment: { cancelled: false } },
          select: { payment: { select: { date: true } } },
        },
      },
      orderBy: [{ member: { lastName: "asc" } }, { member: { firstName: "asc" } }],
    }),
  ]);

  const s = stats(dues);
  const rows = dues.filter((d) => !filter.status || d.status === filter.status);
  const canPay = can(user, "payment.create");
  const qs = (patch: Record<string, string>) =>
    `/cotisations/${meta.slug}?${new URLSearchParams({ annee: year, statut: filter.value, ...patch })}`;

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-1.5">
        <BackButton href={`/cotisations?annee=${year}`} />
      </div>

      <div className="px-5 pb-3.5 pt-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: meta.soft, color: meta.color }}>
            <Icon name={meta.icon} size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">{feeType.label}</h1>
            <div className="mt-0.5 text-xs font-semibold text-ink-3">
              {meta.sublabel} · <span className="gph-amount">{formatAriary(amount)}</span>/an
            </div>
          </div>
        </div>
      </div>

      {/* Sélecteur d'année scolaire */}
      <div className="flex gap-2 px-4 pb-3">
        {years.map((y) => {
          const sel = y === year;
          return (
            <Link
              key={y}
              href={qs({ annee: y })}
              replace
              scroll={false}
              aria-current={sel ? "true" : undefined}
              className="flex flex-1 items-center justify-between rounded-xl px-3.5 py-3"
              style={{
                background: sel ? meta.color : "#fff",
                color: sel ? "#fff" : "var(--gph-ink)",
                border: sel ? "none" : "1px solid var(--gph-divider)",
                boxShadow: sel ? "0 8px 18px rgba(0,0,0,0.12)" : "none",
              }}
            >
              <div>
                <div className={`text-[10px] font-bold uppercase tracking-[0.04em] ${sel ? "text-white/80" : "text-ink-3"}`}>Année</div>
                <div className="mt-px text-[15px] font-bold">{y}</div>
              </div>
              {sel && <Check size={18} strokeWidth={3} />}
            </Link>
          );
        })}
      </div>

      <div className="px-4 pb-3">
        <div className="gph-card p-3.5">
          <div className="mb-2 flex items-baseline justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">Encaissé</div>
              <div className="gph-amount text-[22px] font-bold" style={{ color: meta.color }}>{formatAriary(s.collected)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">Sur</div>
              <div className="gph-amount text-sm font-semibold text-ink-2">{formatAriary(s.expected)}</div>
            </div>
          </div>
          <div className="flex">
            <ProgressBar pct={s.expected ? (s.collected / s.expected) * 100 : 0} color={meta.color} track={meta.soft} height={8} />
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-semibold">
            <span className="text-success">● {s.paid} payés</span>
            {s.partial > 0 && <span className="text-warning">● {s.partial} partiels</span>}
            <span className="text-danger">● {s.unpaid} non payés</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-2.5">
        <FilterChips
          options={FILTERS.map((f) => ({
            value: f.value,
            label: f.label,
            count: f.status ? dues.filter((d) => d.status === f.status).length : dues.length,
          }))}
          active={filter.value}
          hrefFor={(v) => qs({ statut: v })}
        />
      </div>

      <div className="flex flex-col gap-2 px-4 pb-4">
        {rows.length === 0 && <EmptyList>{dues.length ? "Aucun membre pour ce filtre." : "Aucune échéance pour cette année."}</EmptyList>}
        {rows.map((d) => {
          const last = d.allocations.map((a) => a.payment.date).sort((a, b) => b.getTime() - a.getTime())[0];
          return (
            <StatusRow
              key={d.member.id}
              name={fullName(d.member)}
              photoUrl={d.member.photoUrl}
              status={d.status as DueStatus}
              detail={
                d.status === "PAID"
                  ? `${formatAriary(d.amountPaid)}${last ? ` · ${formatDate(last)}` : ""}`
                  : d.status === "PARTIAL"
                    ? `${formatAriary(d.amountPaid)} / ${formatAriary(d.amountDue)}${last ? ` · ${formatDate(last)}` : ""}`
                    : "En attente"
              }
              href={
                canPay && d.status !== "PAID"
                  ? `/cotisations/paiement?membre=${d.member.id}&type=${meta.slug}&annee=${year}`
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
