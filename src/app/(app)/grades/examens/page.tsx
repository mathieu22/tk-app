import { Calendar, ChevronRight, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackButton, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { ExamCreateForm } from "./exam-create-form";

export const metadata: Metadata = { title: "Examens de grade" };

export default async function ExamsPage() {
  await requirePermission("grade.manage");
  const exams = await db.gradeExam.findMany({
    orderBy: { date: "desc" },
    include: { candidates: { select: { result: true } } },
  });
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return (
    <>
      <div className="flex items-center gap-3 px-4 pb-2 pt-1.5">
        <BackButton href="/grades" />
        <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em]">Examens de grade</h1>
      </div>
      <div className="px-4 lg:grid lg:grid-cols-[1fr_1.3fr] lg:gap-5">
        <section className="mb-5">
          <SectionTitle>Nouvelle session d&apos;examen</SectionTitle>
          <div className="gph-card p-3.5"><ExamCreateForm today={today} /></div>
        </section>
        <section>
          <SectionTitle>Sessions</SectionTitle>
          <div className="flex flex-col gap-2">
            {exams.map((e) => {
              const passed = e.candidates.filter((c) => c.result === "PASSED").length;
              return (
                <Link key={e.id} href={`/grades/examens/${e.id}`} className="gph-card flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-3">
                      <Calendar size={12} /> {formatDate(e.date)}
                      {e.location && <><MapPin size={12} /> {e.location}</>}
                    </div>
                    <div className="mt-0.5 text-[15px] font-bold">{e.external ? "Examen poom / dan (fédéral)" : "Passage de grade du club"}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-2">
                      <Users size={12} /> {e.candidates.length} candidat(s)
                      {e.status === "CLOSED" && ` · ${passed} admis`}
                    </div>
                  </div>
                  <span className={`gph-badge ${e.status === "CLOSED" ? "neutral" : "primary"}`}>{e.status === "CLOSED" ? "Clôturé" : "En cours"}</span>
                  <ChevronRight size={18} className="text-ink-3" />
                </Link>
              );
            })}
            {exams.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3">Aucune session d&apos;examen.</div>}
          </div>
        </section>
      </div>
    </>
  );
}
