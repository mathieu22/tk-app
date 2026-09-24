// Grade actuel, éligibilité et historique d'un athlète (US-4.2).
// Composant serveur réutilisable : fiche staff (/grades/athletes/[id]) et espace parent / athlète (lecture seule).
import { AlertTriangle, ArrowRight, Award, Calendar, FileDown, Info } from "lucide-react";
import Link from "next/link";
import { gradeSummaries, gradeTitle, poomToDanDue } from "@/app/(app)/grades/data";
import { db } from "@/lib/db";
import { getAssociation } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { gradeShortLabel } from "@/lib/grades";
import { BeltBadge } from "./belt-badge";
import { GradePassageDelete } from "./grade-passage-delete";
import { SectionTitle } from "./ui";

export async function GradeAthleteView({ memberId, canEdit }: { memberId: string; canEdit: boolean }) {
  const [member, association] = await Promise.all([
    db.member.findUniqueOrThrow({ where: { id: memberId } }),
    getAssociation(),
  ]);
  const [summary, passages, grids] = await Promise.all([
    gradeSummaries([member]).then((m) => m.get(member.id)!),
    db.gradePassage.findMany({
      where: { memberId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { grade: { include: { grid: true } } },
    }),
    db.gradeGrid.findMany({ include: { grades: { where: { active: true }, orderBy: { order: "asc" } } } }),
  ]);
  const current = summary.passage?.grade ?? null;
  const grid = grids.find((g) => g.name === summary.gridName);
  const achieved = new Set(passages.map((p) => p.gradeId));
  const adultEq = summary.adultEquivalent ? grid?.grades.find((g) => g.id === summary.adultEquivalent) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Grade actuel */}
      <div className="gph-card p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">Grade actuel</div>
        {current ? (
          <div className="mt-2 flex items-center gap-3">
            <BeltBadge grade={current} width={88} height={22} title={current.beltLabel} />
            <div className="min-w-0">
              <div className="text-lg font-bold leading-tight">{current.beltLabel}</div>
              <div className="text-xs font-medium text-ink-3">
                {gradeShortLabel(current)} · grille {current.grid.name} · obtenu le {formatDate(summary.passage!.date)}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-2">Aucun grade enregistré. Grille applicable : {summary.gridName}.</p>
        )}

        {summary.next && (
          <div className="mt-4 rounded-xl bg-bg p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ArrowRight size={15} className="text-primary" /> Prochain grade : {summary.next.beltLabel}
              <span className="text-xs font-medium text-ink-3">({gradeShortLabel(summary.next)})</span>
            </div>
            {summary.next.poomsae && (
              <div className="mt-1 text-xs text-ink-2">
                Poomsae exigé : <b>{summary.next.poomsae}</b>{summary.next.drawRule && ` + ${summary.next.drawRule}`}
              </div>
            )}
            <div className="mt-2">
              {summary.eligible ? (
                <span className="gph-badge success"><Award size={12} /> Éligible au passage</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {summary.reasons.map((r) => <span key={r} className="gph-badge warning">{r}</span>)}
                </div>
              )}
              {summary.attendancePct !== null && (
                <span className="ml-2 text-xs font-medium text-ink-3">Présence 12 mois : {summary.attendancePct} %</span>
              )}
            </div>
          </div>
        )}

        {adultEq && current?.grid.name === "Enfant" && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--gph-warning-soft)] p-3 text-xs font-semibold text-[var(--gph-warning-ink)]">
            <Info size={14} className="mt-px flex-none" />
            16 ans atteints : grade équivalent dans la grille Adulte proposé — {gradeTitle(adultEq)}.
          </p>
        )}
        {poomToDanDue(current, member.birthDate, association.poomToDanAge) && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--gph-warning-soft)] p-3 text-xs font-semibold text-[var(--gph-warning-ink)]">
            <AlertTriangle size={14} className="mt-px flex-none" />
            Poom convertible en dan ({association.poomToDanAge} ans atteints) : à signaler à la fédération.
          </p>
        )}
      </div>

      {/* Frise de progression */}
      {grid && (
        <section>
          <SectionTitle>Progression — grille {grid.name}</SectionTitle>
          <div className="gph-card no-scrollbar flex gap-1.5 overflow-x-auto p-3">
            {grid.grades.map((g) => {
              const done = achieved.has(g.id) || (current?.gridId === grid.id && g.order <= current.order);
              const isCurrent = current?.id === g.id;
              return (
                <div key={g.id} className={`flex min-w-[52px] flex-col items-center gap-1 rounded-lg p-1.5 ${isCurrent ? "bg-primary-soft" : ""}`}
                  style={{ opacity: done ? 1 : 0.35 }} title={g.beltLabel}>
                  <BeltBadge grade={g} width={44} height={12} />
                  <span className={`text-[10px] font-bold ${isCurrent ? "text-primary" : "text-ink-2"}`}>{g.number}{g.number === 1 ? "er" : "e"}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Historique */}
      <section>
        <SectionTitle>Historique des passages</SectionTitle>
        <div className="flex flex-col gap-2">
          {passages.map((p) => (
            <div key={p.id} className="gph-card flex items-start gap-3 p-3">
              <BeltBadge grade={p.grade} width={44} height={12} title={p.grade.beltLabel} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{p.grade.beltLabel} <span className="text-xs font-medium text-ink-3">· {gradeShortLabel(p.grade)}</span></div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-ink-3">
                  <span className="inline-flex items-center gap-1"><Calendar size={11} /> {formatDate(p.date)}</span>
                  {p.jury && <span>Jury : {p.jury}</span>}
                  {p.mention && <span>Mention : {p.mention}</span>}
                  {p.certificate && <span className="font-mono">Certificat {p.certificate}</span>}
                </div>
                {p.observation && <p className="mt-1 text-xs text-ink-2">{p.observation}</p>}
                {p.proofUrl && (
                  <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.proofUrl} alt="Justificatif" className="h-14 w-20 rounded-md object-cover" />
                  </a>
                )}
              </div>
              <div className="flex flex-none flex-col items-end gap-1">
                <a href={`/api/grades/attestation/${p.id}`} className="gph-icon-btn" aria-label="Attestation PDF" title="Attestation PDF">
                  <FileDown size={15} />
                </a>
                {canEdit && <GradePassageDelete id={p.id} />}
              </div>
            </div>
          ))}
          {passages.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3">Aucun passage enregistré.</div>}
        </div>
        {canEdit && (
          <Link href={`/grades/passage?membre=${member.id}`} className="gph-btn-primary full mt-3">
            <Award size={16} /> Enregistrer un passage
          </Link>
        )}
      </section>
    </div>
  );
}
