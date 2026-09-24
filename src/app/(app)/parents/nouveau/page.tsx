import type { Metadata } from "next";
import { EspaceParentForm } from "@/components/espace-parent-form";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { RELATIONSHIPS } from "@/lib/parents";

export const metadata: Metadata = { title: "Nouveau parent" };

export default async function NewParentPage() {
  await requirePermission("parent.manage");
  const members = await db.member.findMany({ where: { archived: false }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, matricule: true } });
  return (
    <EspaceParentForm cancelHref="/parents" relationships={RELATIONSHIPS}
      members={members.map((m) => ({ id: m.id, name: `${m.lastName} ${m.firstName} (${m.matricule})` }))} />
  );
}
