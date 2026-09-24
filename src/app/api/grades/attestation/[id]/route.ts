// Attestation de grade PDF (US-4.5) — accessible au staff et à la famille de l'athlète.
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAssociation, requireMemberAccess } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { PdfWriter } from "@/lib/export";
import { formatDate } from "@/lib/format";
import { gradeShortLabel } from "@/lib/grades";

export async function GET(_: Request, ctx: RouteContext<"/api/grades/attestation/[id]">) {
  const { id } = await ctx.params;
  const p = await db.gradePassage.findUnique({ where: { id }, include: { member: true, grade: { include: { grid: true } } } });
  if (!p) notFound();
  await requireMemberAccess(p.memberId);
  const association = await getAssociation();

  const pdf = await PdfWriter.create();
  pdf.text(association.name, { size: 14, bold: true, color: [0.106, 0.369, 0.125] });
  if (association.address) pdf.text(association.address, { size: 9 });
  pdf.gap(30);
  pdf.text("ATTESTATION DE GRADE", { size: 20, bold: true });
  pdf.gap(16);
  pdf.text(`Le club atteste que ${fullName(p.member)} (matricule ${p.member.matricule}),`, { size: 12 });
  pdf.text(`né(e) le ${formatDate(p.member.birthDate)}, a obtenu le grade suivant :`, { size: 12 });
  pdf.gap(10);
  pdf.keyValue("Grade", `${p.grade.beltLabel} — ${gradeShortLabel(p.grade)}`);
  pdf.keyValue("Grille", p.grade.grid.name);
  pdf.keyValue("Date d'obtention", formatDate(p.date));
  if (p.jury) pdf.keyValue("Jury", p.jury);
  if (p.mention) pdf.keyValue("Mention", p.mention);
  if (p.certificate) pdf.keyValue("Certificat Kukkiwon", p.certificate);
  pdf.gap(30);
  pdf.text(`Fait le ${formatDate(new Date())}.`, { size: 11 });
  pdf.gap(40);
  pdf.text("Le Président", { size: 11, x: 400 });
  if (association.receiptFooter) {
    pdf.gap(60);
    pdf.text(association.receiptFooter, { size: 8 });
  }
  return pdf.response(`attestation-${p.member.matricule}-${p.date.toISOString().slice(0, 10)}.pdf`, true);
}
