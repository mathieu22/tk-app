// Vitrine publique du palmarès du club (US-5.4, C). Route publique (voir src/proxy.ts) :
// aucune donnée personnelle sensible — prénom + initiale du nom, médailles uniquement.
import { Medal, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAssociation } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { DISCIPLINES, medalCounts, publicName } from "@/app/(app)/palmares/data";

export const metadata: Metadata = { title: "Palmarès du club" };

export default async function PublicClubPage() {
  const [association, results] = await Promise.all([
    getAssociation(),
    db.result.findMany({
      where: { outcome: { in: ["GOLD", "SILVER", "BRONZE"] } },
      include: { member: { select: { firstName: true, lastName: true } }, competition: true },
      orderBy: { competition: { startDate: "desc" } },
      take: 60,
    }),
  ]);

  const byMember = new Map<string, { name: string; m: ReturnType<typeof medalCounts> }>();
  for (const r of results) {
    const key = publicName(r.member);
    const cur = byMember.get(key) ?? { name: key, m: { gold: 0, silver: 0, bronze: 0 } };
    const c = medalCounts([r]);
    cur.m = { gold: cur.m.gold + c.gold, silver: cur.m.silver + c.silver, bronze: cur.m.bronze + c.bronze };
    byMember.set(key, cur);
  }
  const ranking = [...byMember.values()].sort((a, b) => b.m.gold - a.m.gold || b.m.silver - a.m.silver || b.m.bronze - a.m.bronze).slice(0, 15);

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-bg px-5 pb-16 pt-10">
      <div className="mb-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white"><Trophy size={26} /></div>
        <h1 className="mt-3 text-2xl font-bold tracking-[-0.02em]">{association.name}</h1>
        <p className="mt-1 text-sm text-ink-3">Palmarès du club</p>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-[15px] font-bold">Athlètes les plus titrés</h2>
        <div className="flex flex-col gap-2">
          {ranking.map((r, i) => (
            <div key={r.name} className="gph-card flex items-center gap-3 p-3">
              <span className="w-6 flex-none text-center text-sm font-bold text-ink-3">{i + 1}</span>
              <span className="flex-1 text-sm font-semibold">{r.name}</span>
              <span className="flex gap-2 font-mono text-xs">
                <span>🥇 {r.m.gold}</span><span>🥈 {r.m.silver}</span><span>🥉 {r.m.bronze}</span>
              </span>
            </div>
          ))}
          {ranking.length === 0 && <p className="text-center text-sm text-ink-3">Aucun résultat publié pour l&apos;instant.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-[15px] font-bold"><Medal size={16} /> Derniers résultats</h2>
        <div className="flex flex-col gap-2">
          {results.slice(0, 20).map((r) => (
            <div key={r.id} className="gph-card p-3">
              <div className="text-xs font-semibold text-ink-3">{formatDate(r.competition.startDate)} · {r.competition.name}</div>
              <div className="mt-0.5 flex items-center justify-between text-sm">
                <span className="font-semibold">{publicName(r.member)}</span>
                <span>{r.outcome === "GOLD" ? "🥇" : r.outcome === "SILVER" ? "🥈" : "🥉"} {DISCIPLINES[r.discipline as keyof typeof DISCIPLINES] ?? r.discipline}</span>
              </div>
            </div>
          ))}
          {results.length === 0 && <p className="text-center text-sm text-ink-3">Aucun résultat publié pour l&apos;instant.</p>}
        </div>
      </section>
    </div>
  );
}
