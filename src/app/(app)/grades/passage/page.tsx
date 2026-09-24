import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { gradeShortLabel } from "@/lib/grades";
import { gradeSummaries, MENTIONS } from "../data";
import { PassageForm } from "./passage-form";

export const metadata: Metadata = { title: "Passage de grade" };

export default async function PassagePage(props: PageProps<"/grades/passage">) {
  await requirePermission("grade.manage");
  const sp = await props.searchParams;
  const [members, grids] = await Promise.all([
    db.member.findMany({
      where: { archived: false }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, birthDate: true, groupId: true, joinedAt: true },
    }),
    db.gradeGrid.findMany({ orderBy: { name: "desc" }, include: { grades: { where: { active: true }, orderBy: { order: "asc" } } } }),
  ]);
  const summaries = await gradeSummaries(members);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return (
    <PassageForm
      today={today}
      initialMemberId={typeof sp.membre === "string" ? sp.membre : ""}
      mentions={MENTIONS}
      members={members.map((m) => {
        const s = summaries.get(m.id)!;
        return {
          id: m.id, name: fullName(m), gridName: s.gridName,
          current: s.passage ? `${s.passage.grade.beltLabel} (${gradeShortLabel(s.passage.grade)})` : null,
          nextId: s.next?.id ?? null,
        };
      })}
      grids={grids.map((g) => ({
        name: g.name,
        grades: g.grades.map((x) => ({
          id: x.id, kind: x.kind, label: `${x.beltLabel} · ${gradeShortLabel(x)}`,
          mainColor: x.mainColor, stripeColor: x.stripeColor, stripeCount: x.stripeCount,
        })),
      }))}
    />
  );
}
