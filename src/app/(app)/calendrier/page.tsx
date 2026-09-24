// Calendrier mensuel (US-1.12) : séances et événements, code couleur par type.
// Vue staff (permission attendance.viewAll). Pour l'espace parent/athlète, voir la note dans le
// rapport du fork F1 : réutiliser <CalendarMonth> avec visibleMemberIds() dans le layout (espace).
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarMonth, type CalendarItem } from "@/components/calendar-month";
import { ScreenHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";

export const metadata: Metadata = { title: "Calendrier" };

const MONTH_LABEL = (d: Date) => d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const SESSION_COLOR = "#1B5E20";

function parseMonth(param: string | undefined) {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
const monthParam = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export default async function CalendarPage(props: PageProps<"/calendrier">) {
  await requirePermission("attendance.viewAll");
  const sp = await props.searchParams;
  const month = parseMonth(typeof sp.mois === "string" ? sp.mois : undefined);

  // Grille de 6 semaines (lundi → dimanche) couvrant le mois affiché
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const rangeStart = new Date(firstOfMonth);
  rangeStart.setDate(firstOfMonth.getDate() - startOffset);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeStart.getDate() + 42);

  const [sessions, events] = await Promise.all([
    db.session.findMany({ where: { date: { gte: rangeStart, lt: rangeEnd } } }),
    db.event.findMany({ where: { cancelled: false, startDate: { lt: rangeEnd }, endDate: { gte: rangeStart } }, include: { type: true } }),
  ]);

  const items: CalendarItem[] = [
    ...sessions.map((s): CalendarItem => ({ id: `s-${s.id}`, date: s.date, title: s.title, color: SESSION_COLOR, href: `/presence/${s.id}`, time: s.startTime })),
    ...events.flatMap((e) => {
      const days: Date[] = [];
      for (const d = new Date(Math.max(e.startDate.getTime(), rangeStart.getTime())); d < rangeEnd && d <= e.endDate; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }
      return days.map((d): CalendarItem => ({ id: `e-${e.id}-${d.toISOString()}`, date: d, title: e.title, color: e.type.color, href: `/presence/evenements/${e.id}` }));
    }),
  ];

  const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  return (
    <>
      <ScreenHeader
        title="Calendrier"
        sub={<span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: SESSION_COLOR }} /> Séances · les autres couleurs sont les types d&apos;événements</span>}
      />
      <div className="px-4">
        <div className="mb-4 flex items-center justify-between">
          <Link href={`/calendrier?mois=${monthParam(prev)}`} className="gph-icon-btn" aria-label="Mois précédent"><ChevronLeft size={18} /></Link>
          <div className="text-base font-bold capitalize">{MONTH_LABEL(month)}</div>
          <Link href={`/calendrier?mois=${monthParam(next)}`} className="gph-icon-btn" aria-label="Mois suivant"><ChevronRight size={18} /></Link>
        </div>
        <CalendarMonth month={month} items={items} />
      </div>
    </>
  );
}
