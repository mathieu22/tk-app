import { ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icon";
import { FilterChips, ProgressBar, ScreenHeader, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { FEE_META, fullName, type FeeCode } from "@/lib/domain";
import { calendarYear, ensureDues } from "@/lib/fees";
import { formatAriary, MONTH_LABELS } from "@/lib/format";
import { can } from "@/lib/permissions";
import { availableSchoolYears, referenceMonth, relativeWhen, stats } from "./data";

export const metadata: Metadata = { title: "Cotisations" };

const CODES: FeeCode[] = ["DROIT", "PASSPORT", "ECOLAGE"];
const RING = 2 * Math.PI * 40; // circonférence de l'anneau (r = 40)

export default async function PayDashboard({ searchParams }: PageProps<"/cotisations">) {
  const user = await requirePermission("payment.viewAll");
  const association = await getAssociation();
  const currentSY = association.currentSchoolYear;
  await ensureDues(currentSY);

  const years = await availableSchoolYears(currentSY);
  const { annee } = await searchParams;
  const year = typeof annee === "string" && years.includes(annee) ? annee : currentSY;
  const month = referenceMonth(year, currentSY);

  const feeTypes = await db.feeType.findMany({
    where: { code: { in: CODES } },
    include: {
      tariffs: { where: { schoolYear: year, groupId: null } },
      dues: {
        where: { schoolYear: year, member: { archived: false } },
        select: { month: true, status: true, amountDue: true, amountPaid: true },
      },
    },
  });

  // Écolage : chiffres du mois de référence ; Droit / Passport : chiffres de l'année.
  // La carte de synthèse additionne les deux, soit « ce qui devait être encaissé à ce jour
  // pour la période en cours » — c'est la lecture attendue par le trésorier (US-3.1).
  const cards = CODES.map((code) => {
    const ft = feeTypes.find((f) => f.code === code);
    const monthly = ft?.periodicity === "MONTHLY";
    const dues = (ft?.dues ?? []).filter((d) => d.month === (monthly ? month : 0));
    return { code, label: ft?.label ?? code, monthly, amount: ft?.tariffs[0]?.amount ?? 0, s: stats(dues) };
  });
  const collected = cards.reduce((n, c) => n + c.s.collected, 0);
  const expected = cards.reduce((n, c) => n + c.s.expected, 0);
  const pct = expected ? Math.round((collected / expected) * 100) : 0;
  const monthLabel = `${MONTH_LABELS[month - 1]} ${calendarYear(year, month)}`;
  const memberCount = cards.find((c) => c.code === "ECOLAGE")?.s.total ?? 0;

  const recent = await db.payment.findMany({
    where: { cancelled: false },
    orderBy: { createdAt: "desc" },
    take: 4,
    include: {
      member: { select: { firstName: true, lastName: true, photoUrl: true } },
      allocations: { take: 1, select: { due: { select: { feeType: { select: { code: true, label: true } } } } } },
    },
  });

  return (
    <div>
      <ScreenHeader
        title="Cotisations"
        sub={`${monthLabel} · ${memberCount} membre${memberCount > 1 ? "s" : ""}`}
        action={
          can(user.profile, "payment.create") && (
            <Link href="/cotisations/paiement" className="gph-btn-primary">
              <Plus size={16} strokeWidth={2.5} />
              Paiement
            </Link>
          )
        }
      />

      <div className="px-4 pb-4">
        {years.length > 1 && (
          <div className="mb-3">
            <FilterChips
              options={years.map((y) => ({ value: y, label: y }))}
              active={year}
              hrefFor={(y) => `/cotisations?annee=${y}`}
            />
          </div>
        )}

        {/* Synthèse encaissé / attendu */}
        <div className="gph-card relative mb-3.5 overflow-hidden border-none bg-[linear-gradient(160deg,#0D47A1_0%,#1B5E20_100%)] p-4 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/[0.08]" />
          <div className="relative flex items-center gap-4">
            <div className="relative h-24 w-24 flex-none">
              <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
                <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.18)" strokeWidth="10" fill="none" />
                <circle
                  cx="48" cy="48" r="40" stroke="#fff" strokeWidth="10" fill="none" strokeLinecap={pct > 0 ? "round" : "butt"}
                  strokeDasharray={`${(Math.min(pct, 100) / 100) * RING} ${RING}`}
                  transform="rotate(-90 48 48)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[22px] font-bold tracking-[-0.02em]">{pct}%</div>
                <div className="-mt-0.5 text-[10px] font-semibold opacity-70">collecté</div>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] opacity-75">
                {year === association.currentSchoolYear ? "Encaissé ce mois" : `Encaissé · ${monthLabel}`}
              </div>
              <div className="gph-amount mt-0.5 text-[22px] font-bold leading-[1.1]">{formatAriary(collected)}</div>
              <div className="mt-1 text-xs font-medium opacity-75">
                sur <span className="gph-amount">{formatAriary(expected)}</span> attendus
              </div>
            </div>
          </div>
        </div>

        <SectionTitle>Catégories</SectionTitle>
        <div className="flex flex-col gap-2.5">
          {cards.map((c) => {
            const meta = FEE_META[c.code];
            const ratio = c.s.expected ? (c.s.collected / c.s.expected) * 100 : 0;
            return (
              <Link
                key={c.code}
                href={`/cotisations/${meta.slug}?annee=${year}`}
                className="gph-card flex items-center gap-3.5 p-3.5"
              >
                <div
                  className="flex h-12 w-12 flex-none items-center justify-center rounded-xl"
                  style={{ background: meta.soft, color: meta.color }}
                >
                  <Icon name={meta.icon} size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline gap-2">
                    <div className="text-[15px] font-bold">{c.label}</div>
                    <div className="text-[11px] font-semibold text-ink-3">{c.monthly ? monthLabel : year}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ProgressBar pct={ratio} color={meta.color} height={5} />
                    <div className="min-w-[34px] text-right text-xs font-bold text-ink-2">
                      {c.s.paid}
                      <span className="font-semibold text-ink-3">/{c.s.total}</span>
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-ink-3">
                    <span className="gph-amount">{formatAriary(c.amount)}</span> · {c.monthly ? "par mois" : "par an"}
                    {c.s.partial > 0 && <span className="text-[var(--gph-warning-ink)]"> · {c.s.partial} partiel{c.s.partial > 1 ? "s" : ""}</span>}
                  </div>
                </div>
                <ChevronRight size={18} className="flex-none text-ink-3" />
              </Link>
            );
          })}
        </div>

        <div className="pt-5">
          <SectionTitle>Activité récente</SectionTitle>
        </div>
        {recent.length === 0 ? (
          <div className="gph-card p-5 text-center text-sm text-ink-3">Aucun paiement enregistré pour l&apos;instant.</div>
        ) : (
          <div className="gph-card overflow-hidden p-0">
            {recent.map((p, i) => {
              const ft = p.allocations[0]?.due.feeType;
              const meta = ft && ft.code in FEE_META ? FEE_META[ft.code as FeeCode] : null;
              const name = fullName(p.member);
              return (
                <Link
                  key={p.id}
                  href={`/cotisations/paiement/${p.id}`}
                  className={`flex items-center gap-3 px-3.5 py-2.5 ${i < recent.length - 1 ? "border-b border-divider" : ""}`}
                >
                  <Avatar name={name} size={36} photoUrl={p.member.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{name}</div>
                    <div className="mt-px flex items-center gap-[5px] text-[11px] font-medium text-ink-3">
                      <span className="font-bold" style={{ color: meta?.color }}>{ft?.label ?? "—"}</span>
                      <span>·</span>
                      {relativeWhen(p.date, p.createdAt)}
                    </div>
                  </div>
                  <div className="gph-amount text-[13px] font-bold text-ink">+{formatAriary(p.totalAmount)}</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
