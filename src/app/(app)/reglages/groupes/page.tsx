import type { Metadata } from "next";
import { SettingsGroups } from "@/components/settings-groups";
import { SettingsHeader } from "@/components/settings-ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";

export const metadata: Metadata = { title: "Groupes" };

export default async function GroupsPage() {
  await requirePermission("settings");
  const groups = await db.group.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { members: { where: { archived: false } }, sessions: true } } },
  });
  return (
    <>
      <SettingsHeader title="Groupes" sub="Groupes / créneaux d'entraînement du club (distincts des catégories d'âge officielles)" />
      <SettingsGroups groups={groups.map((g) => ({ id: g.id, name: g.name, description: g.description ?? "", members: g._count.members, sessions: g._count.sessions }))} />
    </>
  );
}
