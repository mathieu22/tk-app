// Fichier .ics pour ajouter un événement à l'agenda du téléphone (US-1.12 C).
import { NextResponse } from "next/server";
import { canSeeEvent } from "@/lib/attendance";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { appUrl } from "@/lib/messaging";

const fold = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

/** Combine une date (jour) et une heure "HH:MM" (heure locale du club, Indian/Antananarivo, UTC+3). */
function localDateTime(date: Date, time: string | null) {
  const [h, m] = (time ?? "09:00").split(":").map(Number);
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), h - 3, m));
  return stamp(d);
}

export async function GET(_req: Request, props: RouteContext<"/api/evenements/[id]/ics">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await props.params;
  const event = await db.event.findUnique({ where: { id }, include: { days: { orderBy: { date: "asc" } } } });
  if (!event) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  if (!(await canSeeEvent(user, id))) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const firstDay = event.days[0];
  const lastDay = event.days.at(-1);
  const dtStart = firstDay ? localDateTime(firstDay.date, firstDay.startTime) : localDateTime(event.startDate, null);
  const end = lastDay ?? firstDay;
  const dtEnd = end ? localDateTime(end.date, end.endTime ?? end.startTime ?? "10:00") : localDateTime(event.endDate, null);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GPH//Gestion de Presence//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:event-${event.id}@gph`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${fold(event.title)}`,
    event.location ? `LOCATION:${fold(event.location)}` : null,
    event.description ? `DESCRIPTION:${fold(event.description)}` : null,
    `URL:${appUrl(`/presence/evenements/${event.id}`)}`,
    event.cancelled ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${event.title.replace(/[^\p{L}\p{N}]+/gu, "-")}.ics"`,
    },
  });
}
