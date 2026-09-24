import type { Metadata } from "next";
import { BeltBadge } from "@/components/belt-badge";
import { BackButton, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { gradeShortLabel } from "@/lib/grades";
import { AddGrade, GradeRowItem, GridForm, MappingSelect } from "./editors";

export const metadata: Metadata = { title: "Référentiel des grades" };

export default async function GradeReferencePage() {
  await requirePermission("grade.manage");
  const [grids, mappings] = await Promise.all([
    db.gradeGrid.findMany({ orderBy: { name: "desc" }, include: { grades: { orderBy: { order: "asc" } } } }),
    db.gradeMapping.findMany(),
  ]);
  const child = grids.find((g) => g.name === "Enfant");
  const adult = grids.find((g) => g.name === "Adulte");
  const mapOf = new Map(mappings.map((m) => [m.childGradeId, m.adultGradeId]));

  return (
    <>
      <div className="flex items-center gap-3 px-4 pb-2 pt-1.5">
        <BackButton href="/grades" />
        <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em]">Référentiel des grades</h1>
      </div>
      <div className="flex flex-col gap-5 px-4">
        <p className="text-[13px] text-ink-2">
          Grilles du club (annexe A). L&apos;ordre va du premier grade (ceinture blanche) au dernier ; la grille applicable
          dépend de l&apos;âge à la date de l&apos;examen.
        </p>
        <div className="grid gap-5 lg:grid-cols-2">
          {grids.map((grid) => (
            <section key={grid.id}>
              <SectionTitle>Grille {grid.name}</SectionTitle>
              <div className="gph-card p-3.5">
                <GridForm grid={grid} />
                <div className="mt-3">
                  {grid.grades.map((g, i) => (
                    <GradeRowItem key={g.id} grade={g} first={i === 0} last={i === grid.grades.length - 1} />
                  ))}
                </div>
                <AddGrade gridId={grid.id} />
              </div>
            </section>
          ))}
        </div>

        {child && adult && (
          <section>
            <SectionTitle>Correspondance Enfant → Adulte (passage à 16 ans)</SectionTitle>
            <div className="gph-card p-3.5">
              <p className="mb-3 text-xs text-ink-3">
                Grade proposé dans la grille Adulte quand un athlète atteint 16 ans. Les valeurs du 15e au 7e keup sont une
                proposition à valider par le club (question ouverte n°1).
              </p>
              <div className="flex flex-col gap-2">
                {child.grades.filter((g) => g.kind === "KEUP").map((g) => (
                  <div key={g.id} className="grid grid-cols-[1fr_1fr] items-center gap-2 sm:grid-cols-[1.2fr_1fr]">
                    <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
                      <BeltBadge grade={g} width={40} height={11} />
                      <span className="truncate">{gradeShortLabel(g)} — {g.beltLabel}</span>
                    </span>
                    <MappingSelect childId={g.id} value={mapOf.get(g.id) ?? ""}
                      options={adult.grades.map((a) => ({ id: a.id, label: `${gradeShortLabel(a)} — ${a.beltLabel}` }))} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="mb-4">
          <SectionTitle>Nouvelle grille</SectionTitle>
          <div className="gph-card p-3.5"><GridForm /></div>
        </section>
      </div>
    </>
  );
}
