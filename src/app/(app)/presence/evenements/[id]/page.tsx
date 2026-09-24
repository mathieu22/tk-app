import { Calendar, Clock3, Coins, Download, FileSpreadsheet, FileText, MapPin, Pencil, ScanLine, Share2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { BackButton, FilterChips, ProgressBar, SectionTitle, StatTile } from "@/components/ui";
import { audienceParentsWhere, audienceWhere, eventStats } from "@/lib/attendance";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { fullName, pctTone, POSITIONS, type Position } from "@/lib/domain";
import { formatAriary } from "@/lib/format";
import { can } from "@/lib/permissions";
import { AddParticipant, CancelEventButton, DeleteEventButton, EventAttendanceMenu, ReminderButton, RemoveParticipantButton } from "./controls";
import { EventTypeIcon, eventDates, RESPONSES, shareText } from "../_meta";

export const metadata: Metadata = { title: "Détail de l'événement" };

const FILTERS = ["tous", "presents", "absents", "attente", "liste-attente"] as const;

export default async function EventDetailPage(props: PageProps<"/presence/evenements/[id]">) {
  const user = await requirePermission("attendance.viewAll");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const filter = FILTERS.find((f) => f === sp.filtre) ?? "tous";

  const event = await db.event.findUnique({
    where: { id },
    include: {
      type: true,
      days: { orderBy: { date: "asc" } },
      registrations: { include: { member: true } },
    },
  });
  if (!event) notFound();
  const association = await getAssociation();
  const manage = can(user, "event.manage");
  const canDelete = user.profile === "ADMIN" || user.profile === "PRESIDENT";
  const parentsEvent = event.audience === "PARENTS";
  const started = event.startDate <= new Date();

  const [st] = await Promise.all([eventStats([event]).then((m) => m.get(event.id)!)]);

  // Présence agrégée par personne (au moins un jour présent)
  const [memberAtt, parentAtt] = await Promise.all([
    parentsEvent ? Promise.resolve([]) : db.attendance.findMany({ where: { eventDay: { eventId: event.id } } }),
    parentsEvent ? db.parentAttendance.findMany({ where: { eventDay: { eventId: event.id } } }) : Promise.resolve([]),
  ]);
  const presentMemberIds = new Set(memberAtt.filter((a) => a.status === "PRESENT").map((a) => a.memberId));
  const presentParentIds = new Set(parentAtt.map((a) => a.parentId));

  type Row = {
    key: string; name: string; role: string; memberId?: string;
    response: string; waitlistRank: number | null; present: boolean; consent: Date | null;
    dueAmount: number | null; duePaid: number | null;
  };
  let rows: Row[] = [];
  let dues = new Map<string, { amountDue: number; amountPaid: number }>();
  if (event.fee) {
    const d = await db.due.groupBy({ by: ["memberId"], where: { eventKey: event.id }, _sum: { amountDue: true, amountPaid: true } });
    dues = new Map(d.map((x) => [x.memberId, { amountDue: x._sum.amountDue ?? 0, amountPaid: x._sum.amountPaid ?? 0 }]));
  }

  if (parentsEvent) {
    const parents = await db.parent.findMany({ where: audienceParentsWhere(), orderBy: { lastName: "asc" } });
    rows = parents.map((p) => ({
      key: p.id, name: `${p.firstName} ${p.lastName}`, role: "Parent", response: "YES", waitlistRank: null,
      present: presentParentIds.has(p.id), consent: null, dueAmount: null, duePaid: null,
    }));
  } else if (event.participationMode === "OPEN") {
    const where = event.audience === "SELECTION"
      ? { id: { in: event.registrations.map((r) => r.memberId) } }
      : audienceWhere(event);
    const members = where ? await db.member.findMany({ where, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }) : [];
    rows = members.map((m) => ({
      key: m.id, name: fullName(m), role: POSITIONS[m.position as Position] ?? m.position, memberId: m.id,
      response: "YES", waitlistRank: null, present: presentMemberIds.has(m.id), consent: null,
      dueAmount: dues.get(m.id)?.amountDue ?? null, duePaid: dues.get(m.id)?.amountPaid ?? null,
    }));
  } else {
    rows = event.registrations
      .sort((a, b) => a.member.lastName.localeCompare(b.member.lastName))
      .map((r) => ({
        key: r.memberId, name: fullName(r.member), role: POSITIONS[r.member.position as Position] ?? r.member.position,
        memberId: r.memberId, response: r.response, waitlistRank: r.waitlistRank, present: presentMemberIds.has(r.memberId),
        consent: r.parentalConsent, dueAmount: dues.get(r.memberId)?.amountDue ?? null, duePaid: dues.get(r.memberId)?.amountPaid ?? null,
      }));
  }

  const counts = {
    tous: rows.length,
    presents: rows.filter((r) => r.present).length,
    absents: rows.filter((r) => !r.present && r.response !== "NO").length,
    attente: rows.filter((r) => r.response === "PENDING" && r.waitlistRank === null).length,
    "liste-attente": rows.filter((r) => r.waitlistRank !== null).length,
  };
  const shown = rows.filter((r) => {
    if (filter === "presents") return r.present;
    if (filter === "absents") return !r.present && r.response !== "NO";
    if (filter === "attente") return r.response === "PENDING" && r.waitlistRank === null;
    if (filter === "liste-attente") return r.waitlistRank !== null;
    return true;
  });

  const tone = pctTone(st.pct, association.thresholdGreen, association.thresholdOrange);
  const dayForScan = event.days.find((d) => d.date.getTime() === new Date(new Date().toDateString()).getTime()) ?? event.days[0];

  return (
    <>
      <div className="flex items-center justify-between px-4 pb-2 pt-1.5">
        <BackButton href="/presence/evenements" />
        <div className="flex gap-2">
          <details className="relative">
            <summary className="gph-icon-btn cursor-pointer list-none" aria-label="Exporter">
              <Download size={16} />
            </summary>
            <div className="gph-card absolute right-0 top-10 z-10 flex w-44 flex-col p-1">
              <a href={`/api/evenements/${event.id}/export?format=xlsx`} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-bg">
                <FileSpreadsheet size={15} /> Excel
              </a>
              <a href={`/api/evenements/${event.id}/export?format=pdf`} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-bg">
                <FileText size={15} /> PDF
              </a>
              <a href={`/api/evenements/${event.id}/ics`} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-bg">
                <Calendar size={15} /> Ajouter à l&apos;agenda
              </a>
            </div>
          </details>
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText(event, event.days[0]?.startTime))}`} target="_blank" rel="noopener noreferrer"
            className="gph-icon-btn" aria-label="Partager">
            <Share2 size={16} />
          </a>
          {manage && (
            <Link href={`/presence/evenements/${event.id}/modifier`} className="gph-icon-btn" aria-label="Modifier">
              <Pencil size={16} />
            </Link>
          )}
          {manage && <CancelEventButton eventId={event.id} cancelled={event.cancelled} />}
          {canDelete && <DeleteEventButton eventId={event.id} />}
        </div>
      </div>

      <div className="px-5 pb-3 pt-1">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl" style={{ background: `${event.type.color}1f`, color: event.type.color }}>
            <EventTypeIcon icon={event.type.icon} size={18} />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-bold" style={{ color: event.type.color }}>{event.type.label}</div>
            <h1 className="m-0 truncate text-[22px] font-bold tracking-[-0.02em]">{event.title}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-ink-3">
          <span className="flex items-center gap-1"><Calendar size={12} />{eventDates(event)}</span>
          {event.days[0]?.startTime && <span className="flex items-center gap-1"><Clock3 size={12} />{event.days[0].startTime.replace(":", "h")}</span>}
          {event.location && <span className="flex items-center gap-1"><MapPin size={12} />{event.location}</span>}
          {event.cancelled && <span className="gph-badge danger">Annulé</span>}
        </div>
        {event.description && <p className="mt-2 text-sm text-ink-2">{event.description}</p>}
      </div>

      <div className="px-4">
        <div className="mb-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile value={st.registered} label={parentsEvent ? "Concernés" : "Inscrits"} />
          <StatTile value={st.present} label="Présents" color="var(--gph-success)" />
          {started && <StatTile value={st.absent} label="Absents" color="var(--gph-danger)" />}
          {started && <StatTile value={`${st.pct}%`} label="Taux" color={`var(--gph-${tone === "success" ? "success" : tone === "warning" ? "warning" : "danger"})`} />}
        </div>

        {event.fee && (
          <div className="gph-card mb-3.5 flex items-center gap-3 p-3.5">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[var(--gph-event-soft)] text-[var(--gph-event)]">
              <Coins size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline justify-between text-[13px] font-semibold text-ink-2">
                <span>Frais encaissés</span>
                <span className="gph-amount font-bold">{formatAriary(st.feesPaid)} / {formatAriary(st.feesDue)}</span>
              </div>
              <ProgressBar pct={st.feesDue ? Math.round((st.feesPaid / st.feesDue) * 100) : 0} color="var(--gph-event)" />
            </div>
          </div>
        )}

        {started && event.days.length > 0 && !event.cancelled && manage && (
          <Link href={`/presence/evenements/${event.id}/scanner${dayForScan ? `?jour=${dayForScan.id}` : ""}`} className="gph-btn-primary full mb-3.5">
            <ScanLine size={18} strokeWidth={2.5} /> Pointer les présences
          </Link>
        )}
        {!started && event.days.length > 0 && !event.cancelled && manage && (
          <Link href={`/presence/evenements/${event.id}/scanner?jour=${event.days[0].id}`} className="gph-btn-ghost mb-3.5 w-full">
            <ScanLine size={18} /> Ouvrir le scanner à l&apos;avance
          </Link>
        )}

        {manage && event.audience !== "PARENTS" && event.participationMode === "REGISTRATION" && counts.attente > 0 && (
          <div className="mb-3.5"><ReminderButton eventId={event.id} /></div>
        )}

        <div className="mb-3 flex items-center justify-between gap-2">
          <FilterChips
            active={filter}
            hrefFor={(f) => `/presence/evenements/${event.id}?filtre=${f}`}
            options={[
              { value: "tous", label: "Tous", count: counts.tous },
              { value: "presents", label: "Présents", count: counts.presents },
              { value: "absents", label: "Absents", count: counts.absents },
              ...(counts.attente ? [{ value: "attente", label: "En attente", count: counts.attente }] : []),
              ...(counts["liste-attente"] ? [{ value: "liste-attente", label: "Liste d'attente", count: counts["liste-attente"] }] : []),
            ]}
          />
        </div>

        {manage && event.audience !== "PARENTS" && event.participationMode !== "OPEN" && (
          <div className="mb-3">
            <AddParticipant eventId={event.id} candidates={rows.filter((r) => r.memberId).map((r) => ({ id: r.memberId!, name: r.name, role: r.role }))} />
          </div>
        )}

        <SectionTitle>Participants</SectionTitle>
        <div className="grid gap-2 lg:grid-cols-2">
          {shown.map((r) => (
            <div key={r.key} className="gph-card flex items-center gap-3 p-2.5">
              <Avatar name={r.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{r.name}</div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-ink-3">
                  {r.role}
                  {r.waitlistRank !== null && <span className="gph-badge warning">Liste d&apos;attente #{r.waitlistRank}</span>}
                  {event.fee && r.dueAmount !== null && (
                    <span className={`gph-badge ${r.duePaid! >= r.dueAmount ? "success" : r.duePaid! > 0 ? "warning" : "danger"}`}>
                      {r.duePaid! >= r.dueAmount ? "Payé" : r.duePaid! > 0 ? "Partiel" : "Non payé"}
                    </span>
                  )}
                </div>
              </div>
              {event.participationMode !== "OPEN" && !parentsEvent && (
                <span className={`gph-badge ${RESPONSES[r.response as keyof typeof RESPONSES]?.tone ?? "neutral"}`}>
                  {RESPONSES[r.response as keyof typeof RESPONSES]?.label ?? r.response}
                </span>
              )}
              {started && (
                <span className={`gph-badge ${r.present ? "success" : "danger"}`}>{r.present ? "Présent" : "Absent"}</span>
              )}
              {manage && r.memberId && event.days[0] && (
                <EventAttendanceMenu eventDayId={event.days[0].id} memberId={r.memberId} status={r.present ? "PRESENT" : "ABSENT"} />
              )}
              {manage && r.memberId && event.participationMode !== "OPEN" && !parentsEvent && (
                <RemoveParticipantButton eventId={event.id} memberId={r.memberId} />
              )}
            </div>
          ))}
          {shown.length === 0 && (
            <div className="gph-card col-span-full flex items-center justify-center gap-2 p-6 text-center text-sm text-ink-3">
              <Users size={16} /> Personne dans ce filtre.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
