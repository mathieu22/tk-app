import type { Metadata } from "next";
import { MemberForm } from "@/components/member-form";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";

export const metadata: Metadata = { title: "Nouveau membre" };

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export default async function NewMemberPage() {
  await requirePermission("member.edit");
  const groups = await db.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return <MemberForm values={{ joinedAt: isoDate(new Date()), nationality: "Malagasy" }} groups={groups} cancelHref="/membres" />;
}
