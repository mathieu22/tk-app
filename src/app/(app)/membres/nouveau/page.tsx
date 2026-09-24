import type { Metadata } from "next";
import { MemberForm } from "@/components/member-form";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { gradeOptions, isoLocal } from "../_lib";

export const metadata: Metadata = { title: "Nouveau membre" };

export default async function NewMemberPage() {
  await requirePermission("member.edit");
  const [groups, grades] = await Promise.all([
    db.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    gradeOptions(),
  ]);
  return <MemberForm values={{ joinedAt: isoLocal(new Date()), nationality: "Malagasy" }} groups={groups} grades={grades} cancelHref="/membres" />;
}
