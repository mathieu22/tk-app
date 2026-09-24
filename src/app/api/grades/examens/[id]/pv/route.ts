// Procès-verbal d'examen de grade PDF (US-4.4) : candidats, tirages, notes, résultats.
import { notFound } from "next/navigation";
import { EXAM_TESTS } from "@/app/(app)/grades/data";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { PdfWriter } from "@/lib/export";
import { formatDate } from "@/lib/format";
import { gradeShortLabel } from "@/lib/grades";

const RESULT = { PASSED: "Admis", FAILED: "Ajourné", PENDING: "En attente" } as Record<string, string>;

export async function GET(_: Request, ctx: RouteContext<"/api/grades/examens/[id]/pv">) {
  await requirePermission("grade.manage");
  const { id } = await ctx.params;
  const exam = await db.gradeExam.findUnique({
    where: { id },
    include: { candidates: { include: { member: true, targetGrade: true }, orderBy: { member: { lastName: "asc" } } } },
  });
  if (!exam) notFound();
  const association = await getAssociation();

  const pdf = await PdfWriter.create();
  pdf.text(association.name, { size: 13, bold: true, color: [0.106, 0.369, 0.125] });
  pdf.gap(8);
  pdf.text(`PROCÈS-VERBAL — ${exam.external ? "EXAMEN POOM / DAN" : "PASSAGE DE GRADE"}`, { size: 16, bold: true });
  pdf.keyValue("Date", formatDate(exam.date));
  if (exam.location) pdf.keyValue("Lieu", exam.location);
  if (exam.jury) pdf.keyValue("Jury", exam.jury);
  pdf.keyValue("Statut", exam.status === "CLOSED" ? "Clôturé" : "En cours");
  pdf.gap(10);
  pdf.table(
    ["Candidat", "Grade visé", ...Object.values(EXAM_TESTS), "Résultat"],
    exam.candidates.map((c) => {
      let s: Record<string, string> = {};
      try { s = JSON.parse(c.scores); } catch { /* vide */ }
      return [fullName(c.member), `${gradeShortLabel(c.targetGrade)}`, ...Object.keys(EXAM_TESTS).map((k) => s[k] ?? "-"), RESULT[c.result] ?? c.result];
    }),
    [120, 60, 50, 45, 50, 45, 50, 75],
  );
  const draws = exam.candidates.filter((c) => c.drawnPoomsae);
  if (draws.length) {
    pdf.gap(10);
    pdf.text("Tirages au sort", { bold: true });
    for (const c of draws) pdf.text(`${fullName(c.member)} : ${c.drawnPoomsae}`, { size: 10 });
  }
  const notes = exam.candidates.filter((c) => c.note);
  if (notes.length) {
    pdf.gap(10);
    pdf.text(exam.external ? "Certificats" : "Appréciations", { bold: true });
    for (const c of notes) pdf.text(`${fullName(c.member)} : ${c.note}`, { size: 10 });
  }
  pdf.gap(20);
  pdf.text(`Admis : ${exam.candidates.filter((c) => c.result === "PASSED").length} / ${exam.candidates.length}`, { bold: true });
  pdf.gap(30);
  pdf.text("Signatures du jury :", { size: 10 });
  return pdf.response(`pv-examen-${exam.date.toISOString().slice(0, 10)}.pdf`, true);
}
