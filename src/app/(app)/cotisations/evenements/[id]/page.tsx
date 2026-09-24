import { CalendarDays, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackButton, FilterChips, ProgressBar, StatTile } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { FEE_META, fullName, type DueStatus } from "@/lib/domain";
import { ensureEventDues } from "@/lib/fees";
import { formatAriary, formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { stats } from "../../data";
import { EmptyList, StatusRow } from "../../status-row";

export const metadata: Metadata = { title: "Frais d'événement" };

const META = FEE_META.EVENT;
const FILTERS: { value: string; label: string; status?: DueStatus }[] = [
  { value: "tous", label: "Tous" },
  { value: "payes", label: "Payés", status: "PAID" },
  { value: "partiels", label: "Partiels", status: "PARTIAL" },
  { value: "non-payes", label: "Non payés", status: "UNPAID" },
];

export default async function EventFeeDetail({ params, searchParams }: PageProps<"/cotisations/evenements/[id]">) {
  const user = await requirePermission("payment.viewAll");
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id }, include: { type: true } });
  if (!event || !event.fee) notFound();
  await ensureEventDues(event.id);

  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.value === sp.statut) ?? FILTERS[0];
  const dues = await db.due.findMany({
    where: { eventKey: event.id, member: { archived: false } },
    select: {
      status: true, amountDue: true, amountPaid: true,
      member: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
    },
    orderBy: [{ member: { lastName: "asc" } }, { member: { firstName: "asc" } }],
  });
  const s = stats(dues);
  const rows = dues.filter((d) => !filter.status || d.status === filter.status);
  const canPay = can(user, "payment.create") && !event.cancelled;
  const sameDay = event.startDate.toDateString() === event.endDate.toDateString();

  return (
    <div>
      <div className="flex items-center px-4 pt-1.5">
        <BackButton href="/cotisations/evenements" />
      </div>
      <div className="px-5 pb-3 pt-2">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-3">
          <span className="gph-dot" style={{ background: event.type.color }} /> {event.type.label}
          <span>·</span>
          <CalendarDays size={12} /> {formatDate(event.startDate)}{!sameDay && ` → ${formatDate(event.endDate)}`}
          {event.location && (<><span>·</span><MapPin size={12} /> {event.location}</>)}
        </div>
        <h1 className="m-0 text-[26px] font-bold tracking-[-0.02em]">{event.title}</h1>
        <div className="mt-0.5 text-xs font-semibold text-ink-3">
          Frais : <span className="gph-amount">{formatAriary(event.fee)}</span> par participant
          {event.cancelled && <span className="gph-badge danger ml-2">Événement annulé</span>}
        </div>
      </div>

      <div className="px-4">
        <div className="gph-card mb-3 p-3.5">
          <div className="mb-2 flex items-baseline justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">Encaissé</div>
              <div className="gph-amount text-[22px] font-bold" style={{ color: META.color }}>{formatAriary(s.collected)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">Attendu</div>
              <div className="gph-amount text-sm font-semibold text-ink-2">{formatAriary(s.expected)}</div>
            </div>
          </div>
          <ProgressBar pct={s.expected ? (s.collected / s.expected) * 100 : 0} color={META.color} height={8} track={META.soft} />
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <StatTile value={s.paid} label="Payés" color="var(--gph-success)" />
          <StatTile value={s.partial} label="Partiels" color="var(--gph-warning)" />
          <StatTile value={s.unpaid} label="Non payés" color="var(--gph-danger)" />
        </div>

        <div className="mb-2.5">
          <FilterChips
            options={FILTERS.map((f) => ({ value: f.value, label: f.label, count: f.status ? dues.filter((d) => d.status === f.status).length : dues.length }))}
            active={filter.value}
            hrefFor={(v) => `/cotisations/evenements/${event.id}?statut=${v}`}
          />
        </div>

        <div className="grid gap-2 pb-4 lg:grid-cols-2">
          {rows.length === 0 && <EmptyList>{dues.length ? "Aucun participant pour ce filtre." : "Aucun participant confirmé pour l'instant."}</EmptyList>}
          {rows.map((d) => (
            <StatusRow
              key={d.member.id}
              name={fullName(d.member)}
              photoUrl={d.member.photoUrl}
              status={d.status as DueStatus}
              detail={d.status === "PARTIAL" ? `${formatAriary(d.amountPaid)} / ${formatAriary(d.amountDue)}` : formatAriary(d.status === "PAID" ? d.amountPaid : d.amountDue)}
              href={canPay && d.status !== "PAID" ? `/cotisations/paiement?membre=${d.member.id}&type=evenement&evenement=${event.id}` : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
