import { Calendar, MapPin, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterChips, ProgressBar, ScreenHeader, SectionTitle } from "@/components/ui";
import type { Prisma } from "@/generated/prisma/client";
import { eventStats } from "@/lib/attendance";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { pctTone } from "@/lib/domain";
import { can } from "@/lib/permissions";
import { PresenceTabs } from "../presence-tabs";
import { EventTypeIcon, eventDates } from "./_meta";

export const metadata: Metadata = { title: "Événements" };

const PERIODS = [
  { value: "annee", label: "Année scolaire" },
  { value: "mois", label: "Ce mois" },
  { value: "tout", label: "Tout" },
];

export default async function EventsPage(props: PageProps<"/presence/evenements">) {
  const user = await requirePermission("attendance.viewAll");
  const association = await getAssociation();
  const sp = await props.searchParams;
  const period = PERIODS.some((p) => p.value === sp.periode) ? String(sp.periode) : "annee";
  const types = await db.eventType.findMany({ orderBy: { label: "asc" } });
  const typeId = types.some((t) => t.id === sp.type) ? String(sp.type) : "";

  const now = new Date();
  const where: Prisma.EventWhereInput = { ...(typeId ? { typeId } : {}) };
  if (period === "mois") {
    where.startDate = { lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    where.endDate = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  } else if (period === "annee") {
    const start = association.schoolYearStartMon;
    const y = now.getMonth() + 1 >= start ? now.getFullYear() : now.getFullYear() - 1;
    where.startDate = { gte: new Date(y, start - 1, 1), lt: new Date(y + 1, start - 1, 1) };
  }
  const events = await db.event.findMany({ where, include: { type: true, days: { orderBy: { date: "asc" }, take: 1 } } });
  const stats = await eventStats(events);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = events.filter((e) => e.endDate >= today).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const past = events.filter((e) => e.endDate < today).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  const tone = (p: number) => pctTone(p, association.thresholdGreen, association.thresholdOrange);
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ periode: period, ...(typeId ? { type: typeId } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/presence/evenements?${p}`;
  };

  const card = (e: (typeof events)[number], isPast: boolean) => {
    const st = stats.get(e.id)!;
    return (
      <Link key={e.id} href={`/presence/evenements/${e.id}`} className={`gph-card block p-3.5 ${e.cancelled ? "opacity-60" : ""}`}>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl" style={{ background: `${e.type.color}1f`, color: e.type.color }}>
            <EventTypeIcon icon={e.type.icon} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-3">
              <Calendar size={12} />
              {eventDates(e)}
              {e.days[0]?.startTime && ` · ${e.days[0].startTime.replace(":", "h")}`}
            </div>
            <div className="truncate text-base font-bold">{e.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-medium text-ink-3">
              <span style={{ color: e.type.color }} className="font-bold">{e.type.label}</span>
              {e.location && <span className="flex items-center gap-1"><MapPin size={11} />{e.location}</span>}
              {e.cancelled && <span className="gph-badge danger">Annulé</span>}
            </div>
          </div>
          {isPast && st.registered > 0 ? (
            <span className={`gph-badge ${tone(st.pct)}`}>{st.pct}%</span>
          ) : (
            <span className="gph-badge neutral"><Users size={11} /> {st.registered}</span>
          )}
        </div>
        {isPast && st.registered > 0 && (
          <div className="mt-3 flex items-center gap-2.5">
            <ProgressBar pct={st.pct} tone={tone(st.pct)} />
            <div className="min-w-[42px] text-right text-[13px] font-bold text-ink-2">
              {st.present}<span className="font-semibold text-ink-3">/{st.registered}</span>
            </div>
          </div>
        )}
        {!isPast && (st.pending > 0 || st.waitlist > 0) && (
          <div className="mt-2 text-xs font-semibold text-ink-3">
            {st.pending > 0 && `${st.pending} en attente de réponse`}
            {st.pending > 0 && st.waitlist > 0 && " · "}
            {st.waitlist > 0 && `${st.waitlist} en liste d'attente`}
          </div>
        )}
      </Link>
    );
  };

  return (
    <>
      <ScreenHeader
        title="Présence"
        sub={`${upcoming.length} à venir · ${past.length} passé${past.length > 1 ? "s" : ""}`}
        action={can(user, "event.manage") && (
          <Link href="/presence/evenements/nouveau" className="gph-btn-primary">
            <Plus size={16} strokeWidth={2.5} /> Nouvel événement
          </Link>
        )}
      />
      <div className="px-4">
        <PresenceTabs active="evenements" />
        <div className="mb-2">
          <FilterChips options={PERIODS} active={period} hrefFor={(v) => qs({ periode: v })} />
        </div>
        <div className="mb-4">
          <FilterChips
            options={[{ value: "", label: "Tous types" }, ...types.map((t) => ({ value: t.id, label: t.label }))]}
            active={typeId}
            hrefFor={(v) => qs({ type: v })}
          />
        </div>

        <SectionTitle>À venir</SectionTitle>
        {upcoming.length ? (
          <div className="mb-5 grid gap-2.5 lg:grid-cols-2">{upcoming.map((e) => card(e, false))}</div>
        ) : (
          <div className="gph-card mb-5 p-6 text-center text-sm text-ink-3">Aucun événement à venir.</div>
        )}
        <SectionTitle>Passés</SectionTitle>
        {past.length ? (
          <div className="grid gap-2.5 lg:grid-cols-2">{past.map((e) => card(e, true))}</div>
        ) : (
          <div className="gph-card p-6 text-center text-sm text-ink-3">Aucun événement passé sur cette période.</div>
        )}
      </div>
    </>
  );
}
