import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { groupIdsOf } from "@/lib/attendance";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { eventFormData, isoDate } from "../../_form-data";
import { EventForm } from "../../event-form";

export const metadata: Metadata = { title: "Modifier l'événement" };

export default async function EditEventPage(props: PageProps<"/presence/evenements/[id]/modifier">) {
  await requirePermission("event.manage");
  const { id } = await props.params;
  const e = await db.event.findUnique({ where: { id }, include: { days: { orderBy: { date: "asc" }, take: 1 }, registrations: { select: { memberId: true } } } });
  if (!e) notFound();
  const data = await eventFormData();
  return (
    <EventForm {...data} cancelHref={`/presence/evenements/${e.id}`} initial={{
      id: e.id, title: e.title, typeId: e.typeId, startDate: isoDate(e.startDate), endDate: isoDate(e.endDate),
      startTime: e.days[0]?.startTime ?? "", endTime: e.days[0]?.endTime ?? "", location: e.location ?? "",
      description: e.description ?? "", audience: e.audience, participationMode: e.participationMode,
      groupIds: groupIdsOf(e).join(","), memberIds: e.audience === "SELECTION" ? e.registrations.map((r) => r.memberId).join(",") : "",
      maxSeats: e.maxSeats ? String(e.maxSeats) : "", registrationUntil: e.registrationUntil ? isoDate(e.registrationUntil) : "",
      fee: e.fee ? String(e.fee) : "",
    }} />
  );
}
