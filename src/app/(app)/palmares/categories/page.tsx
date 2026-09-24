import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackButton, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import {
  AgeCategoryDelete, AgeCategoryForm, AllowedPoomsaeDelete, AllowedPoomsaeForm, DuplicateSeasonButton, SeasonForm, WeightList,
} from "./editors";

export const metadata: Metadata = { title: "Catégories d'âge et de poids" };

export default async function CategoriesPage(props: PageProps<"/palmares/categories">) {
  await requirePermission("palmares.manage");
  const seasons = await db.season.findMany({ orderBy: { year: "desc" }, select: { id: true, year: true, label: true } });
  const sp = await props.searchParams;
  const seasonId = seasons.some((s) => s.id === sp.saison) ? String(sp.saison) : seasons[0]?.id;
  const season = seasonId
    ? await db.season.findUnique({
        where: { id: seasonId },
        include: { ageCategories: { orderBy: { order: "asc" }, include: { weights: { orderBy: { order: "asc" } } } }, allowedPoomsae: { orderBy: { ageMin: "asc" } } },
      })
    : null;
  if (seasonId && !season) notFound();
  const hasNext = season ? seasons.some((s) => s.year === season.year + 1) : false;

  return (
    <>
      <div className="flex items-center gap-3 px-4 pb-2 pt-1.5">
        <BackButton href="/palmares" />
        <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em]">Catégories &amp; poomsae</h1>
      </div>
      <div className="px-4">
        <p className="mb-3 text-[13px] text-ink-2">
          Référentiel de la Fédération Malagasy de Taekwondo (annexe B), modifiable par saison. Une saison peut être dupliquée
          pour préparer la suivante.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {seasons.map((s) => (
            <a key={s.id} href={`/palmares/categories?saison=${s.id}`} className={`gph-chip${s.id === seasonId ? " active" : ""}`}>{s.year}</a>
          ))}
        </div>

        {season ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-2">{season.label}</span>
              {!hasNext && <DuplicateSeasonButton seasonId={season.id} nextYear={season.year + 1} />}
            </div>

            <section className="mb-5">
              <SectionTitle>Catégories d&apos;âge (kyorugi)</SectionTitle>
              <div className="flex flex-col gap-3">
                {season.ageCategories.map((c) => (
                  <div key={c.id} className="gph-card p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{c.name} <span className="font-normal text-ink-3">({c.ageMin}{c.ageMax ? `–${c.ageMax}` : "+"} ans)</span></span>
                      <AgeCategoryDelete id={c.id} />
                    </div>
                    <WeightList ageCategoryId={c.id} weights={c.weights} />
                  </div>
                ))}
              </div>
              <div className="gph-card mt-3 p-3.5">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink-3"><Plus size={13} /> NOUVELLE CATÉGORIE</div>
                <AgeCategoryForm seasonId={season.id} />
              </div>
            </section>

            <section className="mb-5">
              <SectionTitle>Poomsae autorisés</SectionTitle>
              <div className="flex flex-col gap-2">
                {season.allowedPoomsae.map((p) => (
                  <div key={p.id} className="gph-card flex items-start gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">{p.label} <span className="font-normal text-ink-3">({p.ageMin}{p.ageMax ? `–${p.ageMax}` : "+"} ans)</span></div>
                      <div className="mt-0.5 text-xs text-ink-2">{p.poomsae}</div>
                    </div>
                    <AllowedPoomsaeDelete id={p.id} />
                  </div>
                ))}
              </div>
              <div className="gph-card mt-3 p-3.5">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink-3"><Plus size={13} /> AJOUTER</div>
                <AllowedPoomsaeForm seasonId={season.id} />
              </div>
            </section>
          </>
        ) : (
          <div className="gph-card mb-5 p-6 text-center text-sm text-ink-3">Aucune saison. Créez-en une ci-dessous.</div>
        )}

        <section className="mb-4">
          <SectionTitle>Nouvelle saison</SectionTitle>
          <div className="gph-card p-3.5"><SeasonForm /></div>
        </section>
      </div>
    </>
  );
}
