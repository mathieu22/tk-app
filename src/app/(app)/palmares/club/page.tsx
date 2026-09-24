import { Download, Medal, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackButton, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { DISCIPLINES, LEVEL_ORDER, LEVELS, medalCounts } from "../data";

export const metadata: Metadata = { title: "Palmarès du club" };

export default async function ClubPalmaresPage() {
  await requirePermission("palmares.manage");
  const results = await db.result.findMany({ include: { member: true, competition: true } });

  const bySeason = new Map<number, typeof results>();
  for (const r of results) {
    const year = r.competition.startDate.getFullYear();
    bySeason.set(year, [...(bySeason.get(year) ?? []), r]);
  }
  const seasons = [...bySeason.keys()].sort((a, b) => b - a);

  const byLevel = new Map<string, ReturnType<typeof medalCounts>>();
  for (const level of Object.keys(LEVELS)) byLevel.set(level, medalCounts(results.filter((r) => r.competition.level === level)));

  const byDiscipline = new Map<string, ReturnType<typeof medalCounts>>();
  for (const d of Object.keys(DISCIPLINES)) byDiscipline.set(d, medalCounts(results.filter((r) => r.discipline === d)));

  const byMember = new Map<string, { name: string; id: string; m: ReturnType<typeof medalCounts> }>();
  for (const r of results) {
    const cur = byMember.get(r.memberId) ?? { name: fullName(r.member), id: r.memberId, m: { gold: 0, silver: 0, bronze: 0 } };
    const c = medalCounts([r]);
    cur.m = { gold: cur.m.gold + c.gold, silver: cur.m.silver + c.silver, bronze: cur.m.bronze + c.bronze };
    byMember.set(r.memberId, cur);
  }
  const ranking = [...byMember.values()]
    .filter((m) => m.m.gold + m.m.silver + m.m.bronze > 0)
    .sort((a, b) => b.m.gold - a.m.gold || b.m.silver - a.m.silver || b.m.bronze - a.m.bronze)
    .slice(0, 20);

  const MedalRow = ({ label, m }: { label: string; m: ReturnType<typeof medalCounts> }) => (
    <div className="flex items-center justify-between border-b border-divider py-2 text-[13px] last:border-none">
      <span className="font-semibold">{label}</span>
      <span className="flex gap-3 font-mono text-xs">
        <span>🥇 {m.gold}</span><span>🥈 {m.silver}</span><span>🥉 {m.bronze}</span>
      </span>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between px-4 pb-2 pt-1.5">
        <BackButton href="/palmares" />
        <div className="flex gap-2">
          <a href="/api/palmares/club" target="_blank" rel="noopener noreferrer" className="gph-btn-ghost py-2 text-[13px]"><Download size={14} /> Export PDF</a>
          <Link href="/club" target="_blank" className="gph-btn-ghost py-2 text-[13px]"><Trophy size={14} /> Vitrine publique</Link>
        </div>
      </div>
      <h1 className="m-0 px-5 pb-3 text-[22px] font-bold tracking-[-0.02em]">Palmarès du club</h1>
      <div className="px-4 lg:grid lg:grid-cols-2 lg:gap-5">
        <section className="mb-5">
          <SectionTitle>Par saison</SectionTitle>
          <div className="gph-card p-3.5">
            {seasons.map((y) => <MedalRow key={y} label={String(y)} m={medalCounts(bySeason.get(y)!)} />)}
            {seasons.length === 0 && <p className="py-2 text-center text-sm text-ink-3">Aucun résultat.</p>}
          </div>
        </section>
        <section className="mb-5">
          <SectionTitle>Par niveau</SectionTitle>
          <div className="gph-card p-3.5">
            {LEVEL_ORDER.map((l) => <MedalRow key={l} label={LEVELS[l]} m={byLevel.get(l)!} />)}
          </div>
        </section>
        <section className="mb-5">
          <SectionTitle>Par discipline</SectionTitle>
          <div className="gph-card p-3.5">
            {Object.entries(DISCIPLINES).map(([k, l]) => <MedalRow key={k} label={l} m={byDiscipline.get(k)!} />)}
          </div>
        </section>
        <section className="mb-5">
          <SectionTitle><span className="inline-flex items-center gap-1.5"><Medal size={15} /> Athlètes les plus titrés</span></SectionTitle>
          <div className="flex flex-col gap-2">
            {ranking.map((r, i) => (
              <Link key={r.id} href={`/palmares/athletes/${r.id}`} className="gph-card flex items-center gap-3 p-2.5">
                <span className="w-6 flex-none text-center text-sm font-bold text-ink-3">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                <span className="flex gap-2 font-mono text-xs">
                  <span>🥇 {r.m.gold}</span><span>🥈 {r.m.silver}</span><span>🥉 {r.m.bronze}</span>
                </span>
              </Link>
            ))}
            {ranking.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3">Aucune médaille.</div>}
          </div>
        </section>
      </div>
    </>
  );
}
