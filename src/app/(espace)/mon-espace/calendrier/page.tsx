import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EspaceChildPicker } from "@/components/espace-child-picker";
import { db } from "@/lib/db";
import { formatDate, MONTH_LABELS } from "@/lib/format";
import { espaceContext, memberSessionsWhere, relevantEvents } from "../../context";

export const metadata: Metadata = { title: "Calendrier" };

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

type Item = { id: string; date: Date; title: string; color: string; kind: "Séance" | string; time?: string | null; href?: string };

/** Calendrier mensuel (US-1.12) : séances du groupe de l'enfant et événements qui le concernent. */
export default async function EspaceCalendar(props: PageProps<"/mon-espace/calendrier">) {
  const sp = await props.searchParams;
  const { children, selected } = await espaceContext(sp.enfant);
  const now = new Date();
  const m = typeof sp.mois === "string" && /^\d{4}-\d{2}$/.test(sp.mois) ? sp.mois : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, mo] = m.split("-").map(Number);
  const from = new Date(y, mo - 1, 1);
  const to = new Date(y, mo, 1);
  const shift = (n: number) => {
    const d = new Date(y, mo - 1 + n, 1);
    return `?mois=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}${selected ? `&enfant=${selected.id}` : ""}`;
  };

  const items: Item[] = [];
  if (selected) {
    const member = await db.member.findUniqueOrThrow({ where: { id: selected.id } });
    const [sessions, events] = await Promise.all([
      db.session.findMany({ where: memberSessionsWhere(member.groupId, from, to), orderBy: { date: "asc" } }),
      relevantEvents(member, from, to),
    ]);
    for (const s of sessions) items.push({ id: s.id, date: s.date, title: s.title, color: "var(--gph-primary)", kind: "Séance", time: s.startTime });
    for (const e of events) {
      // Un point par jour de l'événement (multi-jours)
      for (const d = new Date(Math.max(+e.startDate, +from)); d <= e.endDate && d < to; d.setDate(d.getDate() + 1)) {
        items.push({ id: `${e.id}-${key(d)}`, date: new Date(d), title: e.title, color: e.type.color, kind: e.type.label,
          time: e.days.find((x) => key(x.date) === key(d))?.startTime, href: `/mon-espace/evenements${selected ? `?enfant=${selected.id}` : ""}` });
      }
    }
  }
  items.sort((a, b) => +a.date - +b.date || (a.time ?? "").localeCompare(b.time ?? ""));
  const byDay = new Map<string, Item[]>();
  for (const it of items) byDay.set(key(it.date), [...(byDay.get(key(it.date)) ?? []), it]);

  // Grille : semaine commençant le lundi
  const lead = (from.getDay() + 6) % 7;
  const days = new Date(y, mo, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(y, mo - 1, i + 1))];
  const todayKey = key(now);

  return (
    <>
      <header className="flex items-center justify-between px-5 pb-3 pt-3.5">
        <h1 className="m-0 text-[28px] font-bold tracking-[-0.02em]">Calendrier</h1>
        <div className="flex items-center gap-1">
          <Link href={shift(-1)} className="gph-icon-btn" aria-label="Mois précédent"><ChevronLeft size={18} /></Link>
          <span className="min-w-[120px] text-center text-sm font-bold">{MONTH_LABELS[mo - 1]} {y}</span>
          <Link href={shift(1)} className="gph-icon-btn" aria-label="Mois suivant"><ChevronRight size={18} /></Link>
        </div>
      </header>
      <EspaceChildPicker items={children.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, photoUrl: c.photoUrl }))} selectedId={selected?.id ?? null} />

      <div className="px-4 lg:grid lg:grid-cols-[1fr_320px] lg:gap-4">
        <div className="gph-card mb-3.5 p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-ink-3">
            {WEEKDAYS.map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const list = byDay.get(key(d)) ?? [];
              const isToday = key(d) === todayKey;
              return (
                <div key={i} className={`flex min-h-[44px] flex-col items-center rounded-lg pt-1 lg:min-h-[64px] ${isToday ? "bg-primary-soft" : ""}`}>
                  <span className={`text-[13px] font-semibold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</span>
                  <span className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                    {list.slice(0, 3).map((it) => <span key={it.id} className="gph-dot" style={{ background: it.color, width: 6, height: 6 }} title={it.title} />)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {items.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3">Rien de prévu ce mois-ci.</div>}
          {items.map((it) => {
            const row = (
              <>
                <span className="h-9 w-1.5 flex-none rounded-full" style={{ background: it.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-ink-3">{formatDate(it.date)}{it.time ? ` · ${it.time.replace(":", "h")}` : ""} · {it.kind}</div>
                  <div className="truncate text-sm font-semibold">{it.title}</div>
                </div>
              </>
            );
            return it.href ? (
              <Link key={it.id} href={it.href} className="gph-card flex items-center gap-3 p-3">{row}</Link>
            ) : (
              <div key={it.id} className="gph-card flex items-center gap-3 p-3">{row}</div>
            );
          })}
        </div>
      </div>
    </>
  );
}
