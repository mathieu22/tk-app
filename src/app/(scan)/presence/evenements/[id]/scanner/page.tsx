import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eventStats } from "@/lib/attendance";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { Scanner } from "../../../../_scanner/scanner";

export const metadata: Metadata = { title: "Scanner — événement" };

const dayLabel = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });

export default async function EventScannerPage(props: PageProps<"/presence/evenements/[id]/scanner">) {
  await requirePermission("session.manage");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const event = await db.event.findUnique({ where: { id }, include: { days: { orderBy: { date: "asc" } } } });
  if (!event || event.days.length === 0) notFound();

  // Journée : ?jour=…, sinon aujourd'hui, sinon la première (pointage par jour, US-1.9)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day =
    event.days.find((d) => d.id === sp.jour) ??
    event.days.find((d) => d.date.getTime() === today.getTime()) ??
    event.days[0];
  const parents = event.audience === "PARENTS";
  const [stats, present] = await Promise.all([
    eventStats([event]),
    parents
      ? db.parentAttendance.count({ where: { eventDayId: day.id } })
      : db.attendance.count({ where: { eventDayId: day.id, status: "PRESENT" } }),
  ]);
  return (
    <Scanner
      target={{ kind: "eventDay", id: day.id }}
      eyebrow={parents ? "Réunion des parents" : event.days.length > 1 ? `Jour ${event.days.indexOf(day) + 1} / ${event.days.length}` : "Événement"}
      title={event.title}
      closed={event.cancelled}
      closedMessage="Événement annulé : pointage impossible."
      expected={stats.get(event.id)!.registered}
      initialPresent={present}
      closeHref={`/presence/evenements/${event.id}`}
      days={event.days.map((d) => ({ id: d.id, label: dayLabel(d.date), href: `/presence/evenements/${event.id}/scanner?jour=${d.id}` }))}
      allowDeparture={!parents}
    />
  );
}
