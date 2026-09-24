import type { Metadata } from "next";
import { SettingsEventTypes } from "@/components/settings-event-types";
import { SettingsHeader } from "@/components/settings-ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";

export const metadata: Metadata = { title: "Types d'événements" };

export default async function EventTypesPage() {
  await requirePermission("settings");
  const types = await db.eventType.findMany({ orderBy: { label: "asc" }, include: { _count: { select: { events: true } } } });
  return (
    <>
      <SettingsHeader title="Types d'événements" sub="Icône et couleur utilisées dans la liste des événements et le calendrier" />
      <SettingsEventTypes types={types.map((t) => ({ id: t.id, label: t.label, icon: t.icon, color: t.color, events: t._count.events }))} />
    </>
  );
}
