import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import { EspaceChildPicker } from "@/components/espace-child-picker";
import { EspaceEventResponse } from "@/components/espace-event-response";
import { BackButton } from "@/components/ui";
import { isMinor } from "@/lib/categories";
import { db } from "@/lib/db";
import { formatAriary, formatDate } from "@/lib/format";
import { espaceContext, relevantEvents, withChild } from "../../context";

export const metadata: Metadata = { title: "Événements" };

const MODE_LABELS: Record<string, string> = { SUMMONS: "Convocation", REGISTRATION: "Inscription", OPEN: "Ouvert à tous" };

/**
 * Événements à venir qui concernent les enfants visibles (US-1.8). Un parent répond pour
 * chacun de ses enfants ; l'enfant sélectionné apparaît en premier.
 */
export default async function EspaceEvents(props: PageProps<"/mon-espace/evenements">) {
  const sp = await props.searchParams;
  const { children, selected, preview } = await espaceContext(sp.enfant);
  // En prévisualisation staff, seul l'enfant sélectionné est traité.
  const targets = preview ? (selected ? [selected] : []) : [...children].sort((a) => (a.id === selected?.id ? -1 : 1));
  const members = await db.member.findMany({ where: { id: { in: targets.map((c) => c.id) } } });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Événement → enfants concernés (avec leur inscription)
  const byEvent = new Map<string, { event: Awaited<ReturnType<typeof relevantEvents>>[number]; kids: { member: (typeof members)[number]; reg: { response: string; waitlistRank: number | null } | null }[] }>();
  for (const m of members) {
    for (const e of await relevantEvents(m, today)) {
      const entry = byEvent.get(e.id) ?? { event: e, kids: [] };
      entry.kids.push({ member: m, reg: e.registrations[0] ?? null });
      byEvent.set(e.id, entry);
    }
  }
  const list = [...byEvent.values()].sort((a, b) => +a.event.startDate - +b.event.startDate);
  const seats = await db.eventRegistration.groupBy({
    by: ["eventId"], where: { eventId: { in: list.map((l) => l.event.id) }, response: "YES", waitlistRank: null }, _count: true,
  });

  return (
    <>
      <div className="flex items-center gap-3 px-4 pb-2 pt-3">
        <BackButton href={withChild("/mon-espace", selected?.id)} />
        <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em]">Événements</h1>
      </div>
      {preview && <EspaceChildPicker items={children.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, photoUrl: c.photoUrl }))} selectedId={selected?.id ?? null} />}

      <div className="flex flex-col gap-3 px-4 lg:grid lg:grid-cols-2">
        {list.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3 lg:col-span-2">Aucun événement à venir.</div>}
        {list.map(({ event: e, kids }) => {
          const closed = e.participationMode === "OPEN" || (!!e.registrationUntil && e.registrationUntil < new Date());
          const taken = seats.find((s) => s.eventId === e.id)?._count ?? 0;
          return (
            <article key={e.id} className="gph-card overflow-hidden">
              <div className="h-1.5" style={{ background: e.type.color }} />
              <div className="p-3.5">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-ink-3">
                  <CalendarDays size={12} />
                  {formatDate(e.startDate)}{+e.endDate - +e.startDate > 864e5 && ` → ${formatDate(e.endDate)}`}
                  <span className="gph-badge neutral ml-auto" style={{ color: e.type.color }}>{e.type.label}</span>
                </div>
                <h2 className="m-0 text-base font-bold">{e.title}</h2>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-ink-3">
                  {e.days[0]?.startTime && <span className="flex items-center gap-1"><Clock size={11} />{e.days[0].startTime.replace(":", "h")}</span>}
                  {e.location && <span className="flex items-center gap-1"><MapPin size={11} />{e.location}</span>}
                  {e.maxSeats && <span className="flex items-center gap-1"><Users size={11} />{taken}/{e.maxSeats} places</span>}
                  <span>{MODE_LABELS[e.participationMode]}</span>
                  {e.fee ? <span className="gph-amount">{formatAriary(e.fee)}</span> : null}
                </div>
                {e.description && <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{e.description}</p>}
                {e.registrationUntil && !closed && (
                  <p className="mt-2 text-xs font-semibold text-[var(--gph-warning-ink)]">Réponse avant le {formatDate(e.registrationUntil)}</p>
                )}
                {e.participationMode !== "OPEN" && (
                  <div className="mt-3 flex flex-col gap-3 border-t border-divider pt-3">
                    {kids.map(({ member, reg }) => (
                      <EspaceEventResponse key={member.id} eventId={e.id} memberId={member.id} childName={member.firstName}
                        current={reg && reg.response !== "PENDING" ? reg.response : null} waitlistRank={reg?.waitlistRank ?? null}
                        minor={isMinor(member.birthDate)} closed={closed} />
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
