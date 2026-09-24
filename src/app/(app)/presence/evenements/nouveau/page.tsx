import type { Metadata } from "next";
import { requirePermission } from "@/lib/dal";
import { eventFormData, isoDate } from "../_form-data";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "Nouvel événement" };

export default async function NewEventPage() {
  await requirePermission("event.manage");
  const data = await eventFormData();
  return <EventForm {...data} initial={{ startDate: isoDate(new Date()), audience: "ALL", participationMode: "REGISTRATION" }} cancelHref="/presence/evenements" />;
}
