import { Calendar, CalendarCheck2, FileDown, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, SectionTitle, StatTile } from "@/components/ui";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { gradeShortLabel } from "@/lib/grades";
import { duesUpToDate, gradeSummaries } from "../../data";
import { CandidatePicker, ResultsForm } from "./exam-client";

export const metadata: Metadata = { title: "Examen de grade" };

export default async function ExamPage(props: PageProps<"/grades/examens/[id]">) {
  await requirePermission("grade.manage");
  const { id } = await props.params;
  const exam = await db.gradeExam.findUnique({
    where: { id },
    include: {
      candidates: { include: { member: true, targetGrade: true }, orderBy: { member: { lastName: "asc" } } },
    },
  });
  if (!exam) notFound();
  const association = await getAssociation();
  const closed = exam.status === "CLOSED";

  const [members, grades] = await Promise.all([
    db.member.findMany({
      where: { archived: false, status: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, birthDate: true, groupId: true, joinedAt: true },
    }),
    db.grade.findMany({ where: { active: true }, include: { grid: true }, orderBy: [{ grid: { name: "desc" } }, { order: "asc" }] }),
  ]);
  const summaries = await gradeSummaries([...members, ...exam.candidates.map((c) => c.member)]);
  const dues = await duesUpToDate(members.map((m) => m.id), association.currentSchoolYear, association.schoolYearStartMon);
  const candidateIds = new Set(exam.candidates.map((c) => c.memberId));
  const label = (g: { beltLabel: string; kind: string; number: number }) => `${g.beltLabel} (${gradeShortLabel(g)})`;

  const passed = exam.candidates.filter((c) => c.result === "PASSED").length;
  const failed = exam.candidates.filter((c) => c.result === "FAILED").length;

  return (
    <>
      <div className="flex items-center justify-between px-4 pb-2 pt-1.5">
        <BackButton href="/grades/examens" />
        <a href={`/api/grades/examens/${exam.id}/pv`} className="gph-btn-ghost py-2 text-[13px]"><FileDown size={15} /> Procès-verbal</a>
      </div>
      <div className="px-5 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-3">
          <Calendar size={12} /> {formatDate(exam.date)}
          {exam.location && <><MapPin size={12} /> {exam.location}</>}
          {closed && <span className="gph-badge neutral">Clôturé</span>}
        </div>
        <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em]">{exam.external ? "Examen poom / dan" : "Passage de grade"}</h1>
        {exam.jury && <div className="text-[13px] text-ink-2">Jury : {exam.jury}</div>}
        {exam.eventId && (
          <Link href={`/presence/evenements/${exam.eventId}`} className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <CalendarCheck2 size={13} /> Événement lié (convocations et présence)
          </Link>
        )}
      </div>
      <div className="px-4">
        <div className="mb-4 grid grid-cols-3 gap-2">
          <StatTile value={exam.candidates.length} label="Candidats" color="var(--gph-ink-2)" />
          <StatTile value={passed} label="Admis" color="var(--gph-success)" />
          <StatTile value={failed} label="Ajournés" color="var(--gph-danger)" />
        </div>
        <div className="lg:grid lg:grid-cols-[1.4fr_1fr] lg:gap-5">
          <section className="mb-5">
            <SectionTitle>Candidats et résultats</SectionTitle>
            <ResultsForm
              examId={exam.id}
              closed={closed}
              external={exam.external}
              gradeOptions={grades.map((g) => ({ id: g.id, label: `${g.grid.name} — ${label(g)}` }))}
              candidates={exam.candidates.map((c) => {
                const s = summaries.get(c.memberId);
                let scores: Record<string, string> = {};
                try { scores = JSON.parse(c.scores); } catch { /* vide */ }
                return {
                  id: c.id, name: fullName(c.member), current: s?.passage ? label(s.passage.grade) : null, targetId: c.targetGradeId,
                  target: { ...c.targetGrade, label: label(c.targetGrade) }, drawn: c.drawnPoomsae, scores, result: c.result, note: c.note,
                };
              })}
            />
          </section>
          {!closed && (
            <section className="mb-5">
              <SectionTitle><span className="inline-flex items-center gap-1.5"><Users size={15} /> Convoquer des candidats</span></SectionTitle>
              <div className="gph-card p-3.5">
                <CandidatePicker
                  examId={exam.id}
                  members={members.filter((m) => !candidateIds.has(m.id)).map((m) => {
                    const s = summaries.get(m.id)!;
                    return {
                      id: m.id, name: fullName(m), current: s.passage ? label(s.passage.grade) : null, next: s.next ? label(s.next) : null,
                      eligible: s.eligible && !!s.next, reasons: s.next ? s.reasons : ["Fin de grille"],
                      duesOk: dues.get(m.id) ?? true, attendancePct: s.attendancePct,
                    };
                  })}
                />
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
