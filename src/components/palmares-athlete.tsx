// Palmarès d'un athlète (US-5.3) : médailles, résultats, pesées, catégorie, alertes, poomsae autorisés.
// Composant serveur réutilisable : fiche staff (/palmares/athletes/[id]) et espace parent / athlète.
import { AlertTriangle, Calendar, MapPin, Medal, Plus, Scale } from "lucide-react";
import { competitionProfile, getSeason } from "@/lib/categories";
import { db } from "@/lib/db";
import { getAssociation } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { DISCIPLINES, LEVELS, medalCounts, OUTCOMES, outcomeLabel } from "@/app/(app)/palmares/data";
import { PalmaresWeighInChart } from "./palmares-weighin-chart";
import { SectionTitle } from "./ui";
import { WeighInDeleteButton, WeighInForm } from "./palmares-weighin-form";

export async function PalmaresAthleteView({ memberId, canEdit }: { memberId: string; canEdit: boolean }) {
  const [member, results, weighIns, association, season] = await Promise.all([
    db.member.findUniqueOrThrow({ where: { id: memberId } }),
    db.result.findMany({ where: { memberId }, include: { competition: true }, orderBy: { createdAt: "desc" } }),
    db.weighIn.findMany({ where: { memberId }, orderBy: { date: "desc" } }),
    getAssociation(),
    getSeason(),
  ]);
  const medals = medalCounts(results);
  const bestByLevel = new Map<string, (typeof results)[number]>();
  for (const r of results) {
    const cur = bestByLevel.get(r.competition.level);
    if (!cur || (["GOLD", "SILVER", "BRONZE"].includes(r.outcome) && !["GOLD", "SILVER", "BRONZE"].includes(cur.outcome))) bestByLevel.set(r.competition.level, r);
  }
  const last = weighIns[0] ?? null;
  const profile = season ? competitionProfile(season, member, last, { alertKg: association.weightAlertKg, maxDays: association.weighInMaxDays }) : null;
  const chartData = [...weighIns].reverse().map((w) => ({ date: formatDate(w.date), kg: w.weightKg }));

  return (
    <div className="flex flex-col gap-4">
      {/* Médailles */}
      <div className="gph-card grid grid-cols-3 divide-x divide-divider p-0 text-center">
        {(["gold", "silver", "bronze"] as const).map((k) => (
          <div key={k} className="p-3.5">
            <div className="text-2xl font-bold" style={{ color: OUTCOMES[k === "gold" ? "GOLD" : k === "silver" ? "SILVER" : "BRONZE"].color }}>
              {medals[k]}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-ink-3">
              {k === "gold" ? "🥇 Or" : k === "silver" ? "🥈 Argent" : "🥉 Bronze"}
            </div>
          </div>
        ))}
      </div>

      {/* Catégorie fédérale et alertes */}
      {profile && (
        <div className="gph-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">Catégorie actuelle (saison {season!.year})</div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-sm font-semibold">
            <span className="gph-badge primary">{profile.ageCategory ?? "Non déterminée"}</span>
            {profile.weightCategory && <span className="gph-badge neutral">{profile.weightCategory}</span>}
          </div>
          {profile.poomsae && <p className="mt-2 text-xs text-ink-2">Poomsae autorisés ({profile.poomsae.label}) : {profile.poomsae.list.join(", ")}</p>}
          {(profile.nearLimit || profile.staleWeighIn) && (
            <div className="mt-2 flex flex-col gap-1">
              {profile.nearLimit && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--gph-warning-ink)]"><AlertTriangle size={13} /> Poids proche d&apos;une limite de catégorie.</p>
              )}
              {profile.staleWeighIn && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-danger"><AlertTriangle size={13} /> Dernière pesée de plus de {association.weighInMaxDays} jours.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pesées */}
      <section>
        <SectionTitle>Pesées</SectionTitle>
        <div className="gph-card p-3.5">
          <PalmaresWeighInChart data={chartData} />
          <div className="mt-2 flex flex-col gap-1">
            {weighIns.slice(0, 6).map((w) => (
              <div key={w.id} className="flex items-center justify-between border-b border-divider py-1.5 text-[13px] last:border-none">
                <span className="flex items-center gap-1.5 font-medium text-ink-2"><Scale size={13} /> {formatDate(w.date)}</span>
                <span className="flex items-center gap-2">
                  <span className="gph-amount font-semibold">{w.weightKg} kg</span>
                  {canEdit && <WeighInDeleteButton id={w.id} />}
                </span>
              </div>
            ))}
            {weighIns.length === 0 && <p className="py-2 text-center text-sm text-ink-3">Aucune pesée.</p>}
          </div>
          {canEdit && <div className="mt-3"><WeighInForm memberId={member.id} /></div>}
        </div>
      </section>

      {/* Meilleur résultat par niveau */}
      {bestByLevel.size > 0 && (
        <section>
          <SectionTitle>Meilleur résultat par niveau</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[...bestByLevel.entries()].map(([level, r]) => (
              <div key={level} className="gph-card p-3 text-center">
                <div className="text-[11px] font-semibold text-ink-3">{LEVELS[level as keyof typeof LEVELS] ?? level}</div>
                <div className="mt-1 text-sm font-bold" style={{ color: OUTCOMES[r.outcome as keyof typeof OUTCOMES]?.color }}>{outcomeLabel(r)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Historique chronologique */}
      <section>
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5"><Medal size={15} /> Résultats</span>
        </SectionTitle>
        <div className="flex flex-col gap-2">
          {results.map((r) => (
            <div key={r.id} className="gph-card p-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-3">
                <Calendar size={11} /> {formatDate(r.competition.startDate)}
                {r.competition.location && <><MapPin size={11} /> {r.competition.location}</>}
              </div>
              <div className="mt-0.5 text-sm font-bold">{r.competition.name}</div>
              <div className="mt-0.5 text-xs text-ink-2">
                {DISCIPLINES[r.discipline as keyof typeof DISCIPLINES] ?? r.discipline}
                {r.ageCategory && ` · ${r.ageCategory}`}{r.weightCategory && ` · ${r.weightCategory}`}
              </div>
              <div className="mt-1 text-sm font-bold" style={{ color: OUTCOMES[r.outcome as keyof typeof OUTCOMES]?.color }}>{outcomeLabel(r)}</div>
              {r.observation && <p className="mt-1 text-xs text-ink-2">{r.observation}</p>}
            </div>
          ))}
          {results.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3">Aucun résultat enregistré.</div>}
        </div>
      </section>

      {canEdit && (
        <a href={`/palmares/competitions/nouvelle`} className="gph-btn-primary full mb-2">
          <Plus size={16} /> Nouvelle compétition
        </a>
      )}
    </div>
  );
}
