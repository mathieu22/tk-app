import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EspaceParentForm } from "@/components/espace-parent-form";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { RELATIONSHIPS } from "@/lib/parents";

export const metadata: Metadata = { title: "Modifier le parent" };

export default async function EditParentPage(props: PageProps<"/parents/[id]/modifier">) {
  await requirePermission("parent.manage");
  const { id } = await props.params;
  const parent = await db.parent.findUnique({ where: { id } });
  if (!parent) notFound();
  return <EspaceParentForm parent={parent} cancelHref={`/parents/${id}`} relationships={RELATIONSHIPS} />;
}
