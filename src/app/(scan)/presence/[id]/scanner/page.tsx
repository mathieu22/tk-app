import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { expectedMembersWhere } from "@/lib/attendance";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Scanner" };

export default async function ScannerPage(props: PageProps<"/presence/[id]/scanner">) {
  await requirePermission("session.manage");
  const { id } = await props.params;
  const session = await db.session.findUnique({ where: { id } });
  if (!session) notFound();
  const [expected, present] = await Promise.all([
    db.member.count({ where: expectedMembersWhere(session.groupId) }),
    db.attendance.count({ where: { sessionId: id, status: "PRESENT" } }),
  ]);
  return (
    <Scanner sessionId={session.id} title={session.title} closed={session.status === "CLOSED"}
      expected={expected} initialPresent={present} />
  );
}
