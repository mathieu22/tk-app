import { CalendarDays, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackButton, ProgressBar, SectionTitle } from "@/components/ui";
import { requirePermission } from "@/lib/dal";
import { FEE_META } from "@/lib/domain";
import { formatAriary, formatDate } from "@/lib/format";
import { EmptyList } from "../status-row";
import { eventsWithFees } from "./data";

export const metadata: Metadata = { title: "Frais d'événements" };

const META = FEE_META.EVENT;

export default async function EventFees() {
  await requirePermission("payment.viewAll");
  const events = await eventsWithFees();
  const upcoming = events.filter((e) => e.upcoming);
  const past = events.filter((e) => !e.upcoming).reverse();

  const list = (items: typeof events) => (
    <div className="grid gap-2.5 lg:grid-cols-2">
      {items.map((e) => {
        const pct = e.s.expected ? (e.s.collected / e.s.expected) * 100 : 0;
        const sameDay = e.startDate.toDateString() === e.endDate.toDateString();
        return (
          <Link key={e.id} href={`/cotisations/evenements/${e.id}`} className="gph-card flex items-center gap-3.5 p-3.5">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-3">
                <span className="gph-dot" style={{ background: e.type.color }} />
                {e.type.label} · {formatDate(e.startDate)}{!sameDay && ` → ${formatDate(e.endDate)}`}
              </div>
              <div className="truncate text-[15px] font-bold">{e.title}</div>
              <div className="mt-2 flex items-center gap-2">
                <ProgressBar pct={pct} color={META.color} height={5} />
                <div className="min-w-[34px] text-right text-xs font-bold text-ink-2">
                  {e.s.paid}<span className="font-semibold text-ink-3">/{e.s.total}</span>
                </div>
              </div>
              <div className="mt-1 text-[11px] font-semibold text-ink-3">
                <span className="gph-amount" style={{ color: META.color }}>{formatAriary(e.s.collected)}</span>
                {" / "}<span className="gph-amount">{formatAriary(e.s.expected)}</span> · {formatAriary(e.fee ?? 0)} par participant
              </div>
            </div>
            <ChevronRight size={18} className="flex-none text-ink-3" />
          </Link>
        );
      })}
    </div>
  );

  return (
    <div>
      <div className="flex items-center px-4 pt-1.5">
        <BackButton href="/cotisations" />
      </div>
      <div className="flex items-center gap-2.5 px-5 pb-3 pt-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: META.soft, color: META.color }}>
          <CalendarDays size={22} />
        </div>
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Frais d&apos;événements</h1>
          <div className="mt-0.5 text-xs font-semibold text-ink-3">Stages, compétitions, examens, sorties</div>
        </div>
      </div>
      <div className="px-4 pb-4">
        <SectionTitle>À venir</SectionTitle>
        {upcoming.length ? list(upcoming) : <EmptyList>Aucun événement payant à venir.</EmptyList>}
        <div className="pt-5"><SectionTitle>Passés</SectionTitle></div>
        {past.length ? list(past) : <EmptyList>Aucun événement payant passé.</EmptyList>}
      </div>
    </div>
  );
}
