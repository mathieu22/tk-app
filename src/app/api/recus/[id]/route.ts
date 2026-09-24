// Reçu PDF d'un paiement (US-3.5). Hors proxy : l'accès est vérifié ici.
import { loadReceipt } from "@/app/(app)/cotisations/receipt";
import { getAssociation, getCurrentUser, visibleMemberIds } from "@/lib/dal";
import { DUE_STATUS_META } from "@/lib/domain";
import { PdfWriter } from "@/lib/export";
import { formatAriary, formatDate, formatPhone } from "@/lib/format";

export async function GET(_req: Request, ctx: RouteContext<"/api/recus/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non connecté", { status: 401 });
  const { id } = await ctx.params;
  const r = await loadReceipt(id);
  if (!r) return new Response("Reçu introuvable", { status: 404 });
  if (!user.perms.includes("payment.viewAll")) {
    const ids = await visibleMemberIds(user);
    if (ids !== "ALL" && !ids.includes(r.payment.member.id)) return new Response("Accès refusé", { status: 403 });
  }

  const a = await getAssociation();
  const p = r.payment;
  const pdf = await PdfWriter.create();
  pdf.text(a.name, { size: 18, bold: true });
  if (a.address) pdf.text(a.address, { size: 10, color: [0.4, 0.42, 0.5] });
  const contact = [a.phone && formatPhone(a.phone), a.email].filter(Boolean).join(" · ");
  if (contact) pdf.text(contact, { size: 10, color: [0.4, 0.42, 0.5] });
  pdf.gap(16);
  pdf.text(`REÇU DE PAIEMENT N° ${p.receiptNo}`, { size: 14, bold: true, color: [0.106, 0.369, 0.125] });
  if (p.cancelled) pdf.text("ANNULÉ", { size: 22, bold: true, color: [0.73, 0.11, 0.11] });
  pdf.rule();
  pdf.keyValue("Date", formatDate(p.date));
  pdf.keyValue("Membre", `${r.memberName} (${p.member.matricule})`);
  pdf.keyValue("Type de frais", r.feeLabel);
  pdf.keyValue("Période", r.period);
  pdf.keyValue("Mode de paiement", r.methodLabel);
  if (p.reference) pdf.keyValue("Référence", p.reference);
  pdf.keyValue("Statut", p.cancelled ? "Annulé" : DUE_STATUS_META[r.status].label);
  pdf.keyValue("Saisi par", r.recordedBy);
  if (p.note) pdf.keyValue("Note", p.note.slice(0, 80));
  pdf.rule();
  pdf.keyValue("MONTANT", formatAriary(p.totalAmount));
  if (p.cancelled) {
    pdf.gap(6);
    pdf.text(`Annulé le ${p.cancelledAt ? formatDate(p.cancelledAt) : "—"} par ${r.cancelledBy} : ${p.cancelReason ?? ""}`, { size: 10, color: [0.73, 0.11, 0.11] });
  }
  pdf.gap(24);
  if (a.receiptFooter) pdf.text(a.receiptFooter, { size: 9, color: [0.4, 0.42, 0.5] });
  pdf.text(`Document généré le ${formatDate(new Date())}.`, { size: 8, color: [0.55, 0.56, 0.64] });
  return pdf.response(`${p.receiptNo}.pdf`, true);
}
