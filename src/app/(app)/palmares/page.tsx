import { Calendar, ChevronRight, Download, MapPin, Medal, Plus, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterChips, ScreenHeader, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { LEVELS, medalCounts } from "./data";
import { SeasonSelect } from "./season-select";

export const metadata: Metadata = { title: "Palmarès" };

const LEVEL_FILTERS = [{ value: "tous", label: "Tous" }, ...Object.entries(LEVELS).map(([value, label]) => ({ value, label }))];

export default async function PalmaresPage(props: PageProps<"/palmares">) {
  await requirePermission("palmares.manage");
  const sp = await props.searchParams;
  const level = LEVEL_FILTERS.some((f) => f.value === sp.niveau) ? String(sp.niveau) : "tous";
  const seasons = await db.season.findMany({ orderBy: { year: "desc" }, select: { id: true, year: true } });
  const seasonId = seasons.some((s) => s.id === sp.saison) ? String(sp.saison) : "";
  const season = seasonId ? seasons.find((s) => s.id === seasonId) : null;

  const competitions = await db.competition.findMany({
    where: {
      ...(level !== "tous" && { level }),
      ...(season && { startDate: { gte: new Date(season.year, 0, 1), lt: new Date(season.year + 1, 0, 1) } }),
    },
    orderBy: { startDate: "desc" },
    include: { results: { select: { outcome: true } } },
  });
  const now = new Date();
  const [upcoming, past] = [competitions.filter((c) => c.endDate >= now), competitions.filter((c) => c.endDate < now)];

  const href = (params: Record<string, string>) => {
    const u = new URLSearchParams({ ...(level !== "tous" && { niveau: level }), ...(seasonId && { saison: seasonId }), ...params });
    return `/palmares${u.size ? `?${u}` : ""}`;
  };

  const Card = (c: (typeof competitions)[number]) => {
    const m = medalCounts(c.results);
    return (
      <Link key={c.id} href={`/palmares/competitions/${c.id}`} className="gph-card flex items-center gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-3">
            <Calendar size={12} />
            {formatDate(c.startDate)}{c.endDate.getTime() !== c.startDate.getTime() && ` – ${formatDate(c.endDate)}`}
            {c.location && <><MapPin size={12} /> {c.location}</>}
          </div>
          <div className="mt-0.5 truncate text-[15px] font-bold">{c.name}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-ink-2">
            <span className="gph-badge neutral">{LEVELS[c.level as keyof typeof LEVELS] ?? c.level}</span>
            {c.results.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Medal size={12} /> {m.gold + m.silver + m.bronze} médaille(s) sur {c.results.length}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={18} className="flex-none text-ink-3" />
      </Link>
    );
  };

  return (
    <>
      <ScreenHeader
        title="Palmarès"
        sub={`${competitions.length} compétition(s)`}
        action={
          <Link href="/palmares/competitions/nouvelle" className="gph-btn-primary">
            <Plus size={16} strokeWidth={2.5} /> Compétition
          </Link>
        }
      />
      <div className="px-4">
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
          <Link href="/palmares/club" className="gph-chip"><Trophy size={14} /> Palmarès du club</Link>
          <Link href="/palmares/categories" className="gph-chip"><Users size={14} /> Catégories &amp; poomsae</Link>
          <a href="/api/palmares/export" className="gph-chip"><Download size={14} /> Export Excel</a>
        </div>
        {seasons.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            <SeasonSelect
              seasons={seasons}
              value={seasonId}
              basePath="/palmares"
              otherParams={level !== "tous" ? { niveau: level } : {}}
            />
          </div>
        )}
        <div className="mb-4">
          <FilterChips options={LEVEL_FILTERS} active={level} hrefFor={(v) => href({ niveau: v === "tous" ? "" : v })} />
        </div>

        <section className="mb-5">
          <SectionTitle>À venir</SectionTitle>
          <div className="flex flex-col gap-2">
            {upcoming.map(Card)}
            {upcoming.length === 0 && <div className="gph-card p-5 text-center text-sm text-ink-3">Aucune compétition à venir.</div>}
          </div>
        </section>
        <section>
          <SectionTitle>Passées</SectionTitle>
          <div className="flex flex-col gap-2">
            {past.map(Card)}
            {past.length === 0 && <div className="gph-card p-5 text-center text-sm text-ink-3">Aucune compétition passée.</div>}
          </div>
        </section>
      </div>
    </>
  );
}
