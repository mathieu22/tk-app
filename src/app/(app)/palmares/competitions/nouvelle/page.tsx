import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { CompetitionForm } from "../../competition-form";

export const metadata: Metadata = { title: "Nouvelle compétition" };

export default async function NewCompetitionPage() {
  await requirePermission("palmares.manage");
  const seasons = await db.season.findMany({ orderBy: { year: "desc" }, select: { id: true, year: true } });
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return <CompetitionForm seasons={seasons} today={today} />;
}
