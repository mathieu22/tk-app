import "server-only";
import { db } from "@/lib/db";
import { fullName } from "@/lib/domain";

/** Données des listes du formulaire d'événement. */
export async function eventFormData() {
  const [types, groups, members] = await Promise.all([
    db.eventType.findMany({ orderBy: { label: "asc" }, select: { id: true, label: true, icon: true, color: true } }),
    db.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.member.findMany({ where: { archived: false, status: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], include: { group: true } }),
  ]);
  return { types, groups, members: members.map((m) => ({ id: m.id, name: fullName(m), group: m.group?.name ?? null })) };
}

export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
