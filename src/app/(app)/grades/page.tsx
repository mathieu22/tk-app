import { Award, BookOpen, ChevronRight, Download, GraduationCap, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { BeltBadge, beltHex } from "@/components/belt-badge";
import { GradeDistributionChart } from "@/components/grade-chart";
import { FilterChips, ScreenHeader, SectionTitle, StatTile } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { gradeShortLabel } from "@/lib/grades";
import { gradeSummaries } from "./data";

export const metadata: Metadata = { title: "Grades" };

const FILTERS = [
  { value: "tous", label: "Tous" },
  { value: "eligibles", label: "Éligibles" },
  { value: "sans", label: "Sans grade" },
];

export default async function GradesPage(props: PageProps<"/grades">) {
  await requirePermission("grade.manage");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filter = FILTERS.some((f) => f.value === sp.filtre) ? String(sp.filtre) : "tous";

  const members = await db.member.findMany({
    where: { archived: false, status: "ACTIVE" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, birthDate: true, groupId: true, joinedAt: true, photoUrl: true },
  });
  const summaries = await gradeSummaries(members);

  // Répartition par grade actuel (US-4.5)
  const dist = new Map<string, { label: string; count: number; color: string; order: number }>();
  for (const m of members) {
    const g = summaries.get(m.id)?.passage?.grade;
    const key = g ? g.id : "none";
    const cur = dist.get(key) ?? {
      label: g ? `${gradeShortLabel(g)} ${g.grid.name === "Enfant" ? "(E)" : g.kind === "KEUP" ? "(A)" : ""}`.trim() : "Sans grade",
      count: 0,
      color: g ? beltHex(g.mainColor) : "#D9D9E0",
      order: g ? (g.kind === "KEUP" ? (g.grid.name === "Enfant" ? 0 : 100) + g.order : 200 + g.number) : -1,
    };
    cur.count++;
    dist.set(key, cur);
  }
  const chart = [...dist.values()].sort((a, b) => a.order - b.order);

  const eligibleCount = members.filter((m) => {
    const s = summaries.get(m.id);
    return s?.passage && s.next && s.eligible;
  }).length;

  const shown = members.filter((m) => {
    const s = summaries.get(m.id)!;
    if (q && !fullName(m).toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "eligibles") return !!(s.passage && s.next && s.eligible);
    if (filter === "sans") return !s.passage;
    return true;
  });

  const href = (params: Record<string, string>) => {
    const u = new URLSearchParams({ ...(q && { q }), ...(filter !== "tous" && { filtre: filter }), ...params });
    return `/grades${u.size ? `?${u}` : ""}`;
  };

  return (
    <>
      <ScreenHeader
        title="Grades"
        sub={`${members.length} athlètes actifs`}
        action={
          <Link href="/grades/passage" className="gph-btn-primary">
            <Plus size={16} strokeWidth={2.5} /> Passage
          </Link>
        }
      />
      <div className="px-4">
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
          <Link href="/grades/examens" className="gph-chip"><GraduationCap size={14} /> Examens</Link>
          <Link href="/grades/referentiel" className="gph-chip"><BookOpen size={14} /> Référentiel</Link>
          <a href="/api/grades/export" className="gph-chip"><Download size={14} /> Export Excel</a>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <StatTile value={members.length - (dist.get("none")?.count ?? 0)} label="Gradés" color="var(--gph-primary)" />
          <StatTile value={eligibleCount} label="Éligibles" color="var(--gph-success)" />
          <StatTile value={dist.get("none")?.count ?? 0} label="Sans grade" color="var(--gph-ink-2)" />
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_1.2fr] lg:gap-5">
          <section className="mb-4">
            <SectionTitle>Répartition par grade</SectionTitle>
            <div className="gph-card p-3">
              <GradeDistributionChart data={chart.map(({ label, count, color }) => ({ label, count, color }))} />
              <p className="mt-1 text-[11px] font-medium text-ink-3">(E) grille Enfant · (A) grille Adulte</p>
            </div>
          </section>

          <section>
            <SectionTitle>Athlètes</SectionTitle>
            <form className="mb-3" action="/grades">
              {filter !== "tous" && <input type="hidden" name="filtre" value={filter} />}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                <input name="q" defaultValue={q} placeholder="Rechercher un athlète" className="gph-input with-icon" />
              </div>
            </form>
            <div className="mb-3">
              <FilterChips options={FILTERS} active={filter} hrefFor={(v) => href({ filtre: v === "tous" ? "" : v })} />
            </div>
            <div className="flex flex-col gap-2">
              {shown.map((m) => {
                const s = summaries.get(m.id)!;
                const g = s.passage?.grade;
                return (
                  <Link key={m.id} href={`/grades/athletes/${m.id}`} className="gph-card flex items-center gap-3 p-2.5">
                    <Avatar name={fullName(m)} size={40} photoUrl={m.photoUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{fullName(m)}</div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
                        {g ? (
                          <>
                            <BeltBadge grade={g} width={36} height={10} title={g.beltLabel} />
                            <span className="truncate">{g.beltLabel} · depuis {formatDate(s.passage!.date)}</span>
                          </>
                        ) : (
                          <span>Aucun grade · grille {s.gridName}</span>
                        )}
                      </div>
                    </div>
                    {s.passage && s.next ? (
                      s.eligible ? (
                        <span className="gph-badge success"><Award size={12} /> Éligible</span>
                      ) : (
                        <span className="gph-badge neutral">{s.reasons[0]}</span>
                      )
                    ) : null}
                    <ChevronRight size={18} className="flex-none text-ink-3" />
                  </Link>
                );
              })}
              {shown.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3">Aucun athlète.</div>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
