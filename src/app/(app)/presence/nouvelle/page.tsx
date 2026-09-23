import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { SessionForm } from "./session-form";

export const metadata: Metadata = { title: "Nouvelle session" };

export default async function NewSessionPage() {
  await requirePermission("session.manage");
  const groups = await db.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return <SessionForm groups={groups} today={today} />;
}
