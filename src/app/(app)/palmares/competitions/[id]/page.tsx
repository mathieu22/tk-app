import { Calendar, Download, MapPin, Medal, Pencil, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { BackButton, SectionTitle, StatTile } from "@/components/ui";
import { competitionProfile } from "@/lib/categories";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { DISCIPLINES, LEVELS, OUTCOMES, outcomeLabel, parseFights, seasonForCompetition } from "../../data";
import { DeleteCompetitionButton } from "../../delete-button";
import { DeleteResultButton } from "./delete-result-button";
import { type MemberOpt, ResultsEditor } from "./results-editor";

export const metadata: Metadata = { title: "Compétition" };

export default async function CompetitionPage(props: PageProps<"/palmares/competitions/[id]">) {
  await requirePermission("palmares.manage");
  const { id } = await props.params;
  const competition = await db.competition.findUnique({
    where: { id }, include: { results: { include: { member: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!competition) notFound();
  const association = await getAssociation();

  const [season, allMembers] = await Promise.all([
    seasonForCompetition(competition),
    db.member.findMany({
      where: { archived: false, status: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, sex: true, birthDate: true, weighIns: { orderBy: { date: "desc" }, take: 1 } },
    }),
  ]);
  const resultedIds = new Set(competition.results.map((r) => r.memberId));
  const options: MemberOpt[] = allMembers.filter((m) => !resultedIds.has(m.id)).map((m) => {
    const proposal = season
      ? competitionProfile(season, m, m.weighIns[0] ?? null, { alertKg: association.weightAlertKg, maxDays: association.weighInMaxDays, at: competition.startDate })
      : null;
    return {
      id: m.id, name: fullName(m), sex: m.sex as "M" | "F",
      proposal: proposal ? { ageCategory: proposal.ageCategory, weightCategory: proposal.weightCategory, nearLimit: proposal.nearLimit, staleWeighIn: proposal.staleWeighIn, poomsae: proposal.poomsae?.list ?? null } : null,
    };
  });

  return (
    <>
      <div className="flex items-center justify-between px-4 pb-2 pt-1.5">
        <BackButton href="/palmares" />
        <div className="flex gap-2">
          <a href={`/api/palmares/competitions/${competition.id}/engagement`} className="gph-icon-btn" title="Liste d'engagement" aria-label="Liste d'engagement"><Download size={16} /></a>
          <a href={`/palmares/competitions/${competition.id}/modifier`} className="gph-icon-btn" aria-label="Modifier"><Pencil size={16} /></a>
          <DeleteCompetitionButton id={competition.id} />
        </div>
      </div>
      <div className="px-5 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-3">
          <Calendar size={12} />
          {formatDate(competition.startDate)}{competition.endDate.getTime() !== competition.startDate.getTime() && ` – ${formatDate(competition.endDate)}`}
          {competition.location && <><MapPin size={12} /> {competition.location}</>}
        </div>
        <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em]">{competition.name}</h1>
        <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-2">
          <span className="gph-badge neutral">{LEVELS[competition.level as keyof typeof LEVELS] ?? competition.level}</span>
          {competition.organizer && <span>{competition.organizer}</span>}
        </div>
      </div>
      <div className="px-4">
        <div className="mb-4 grid grid-cols-3 gap-2">
          <StatTile value={competition.results.length} label="Résultats" color="var(--gph-ink-2)" />
          <StatTile value={competition.results.filter((r) => r.outcome === "GOLD").length} label="Or" color="var(--gph-warning)" />
          <StatTile value={competition.results.filter((r) => ["SILVER", "BRONZE"].includes(r.outcome)).length} label="Argent / Bronze" color="var(--gph-ink-3)" />
        </div>

        <div className="lg:grid lg:grid-cols-[1.2fr_1fr] lg:gap-5">
          <section className="mb-5">
            <SectionTitle><span className="inline-flex items-center gap-1.5"><Users size={15} /> Ajouter des résultats</span></SectionTitle>
            <ResultsEditor competitionId={competition.id} members={options} />
          </section>

          <section>
            <SectionTitle><span className="inline-flex items-center gap-1.5"><Medal size={15} /> Résultats enregistrés</span></SectionTitle>
            <div className="flex flex-col gap-2">
              {competition.results.map((r) => (
                <div key={r.id} className="gph-card flex items-start gap-3 p-3">
                  <Avatar name={fullName(r.member)} size={40} photoUrl={r.photoUrl ?? r.member.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{fullName(r.member)}</div>
                    <div className="text-xs text-ink-3">{DISCIPLINES[r.discipline as keyof typeof DISCIPLINES] ?? r.discipline}
                      {r.ageCategory && ` · ${r.ageCategory}`}{r.weightCategory && ` · ${r.weightCategory}`}</div>
                    <div className="mt-1 text-sm font-bold" style={{ color: OUTCOMES[r.outcome as keyof typeof OUTCOMES]?.color }}>{outcomeLabel(r)}</div>
                    {r.observation && <p className="mt-1 text-xs text-ink-2">{r.observation}</p>}
                    {parseFights(r.details).length > 0 && (
                      <ul className="mt-1 text-[11px] text-ink-3">
                        {parseFights(r.details).map((f, i) => <li key={i}>{f.round ? `${f.round} — ` : ""}vs {f.opponent} ({f.score})</li>)}
                      </ul>
                    )}
                  </div>
                  <DeleteResultButton id={r.id} />
                </div>
              ))}
              {competition.results.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3">Aucun résultat.</div>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
