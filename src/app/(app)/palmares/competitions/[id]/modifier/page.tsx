import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { CompetitionForm } from "../../../competition-form";

export const metadata: Metadata = { title: "Modifier la compétition" };

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function EditCompetitionPage(props: PageProps<"/palmares/competitions/[id]/modifier">) {
  await requirePermission("palmares.manage");
  const { id } = await props.params;
  const [competition, seasons] = await Promise.all([
    db.competition.findUnique({ where: { id } }),
    db.season.findMany({ orderBy: { year: "desc" }, select: { id: true, year: true } }),
  ]);
  if (!competition) notFound();
  return (
    <CompetitionForm
      seasons={seasons}
      today={iso(new Date())}
      competition={{ ...competition, startDate: iso(competition.startDate), endDate: iso(competition.endDate) }}
    />
  );
}
