// Export Excel de l'historique des paiements (mêmes filtres que la page).
import { findPayments, parseFilters } from "@/app/(app)/cotisations/paiements/query";
import { periodLabel } from "@/app/(app)/cotisations/data";
import { getCurrentUser } from "@/lib/dal";
import { fullName, OPERATORS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain";
import { xlsxResponse } from "@/lib/export";
import { formatDate } from "@/lib/format";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non connecté", { status: 401 });
  if (!user.perms.includes("payment.viewAll")) return new Response("Accès refusé", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const payments = await findPayments(parseFilters(sp));
  const rows = payments.map((p) => {
    const dues = p.allocations.map((a) => a.due);
    const ft = dues[0]?.feeType;
    return {
      date: formatDate(p.date),
      recu: p.receiptNo,
      matricule: p.member.matricule,
      membre: fullName(p.member),
      type: ft?.label ?? "",
      periode: ft?.code === "EVENT" ? (dues[0].event?.title ?? "") : periodLabel(dues),
      mode: PAYMENT_METHODS[p.method as PaymentMethod]?.label ?? p.method,
      operateur: p.operator ? OPERATORS[p.operator as keyof typeof OPERATORS] ?? p.operator : "",
      reference: p.reference ?? "",
      montant: p.totalAmount,
      statut: p.cancelled ? "Annulé" : "Valide",
      motif: p.cancelReason ?? "",
      note: p.note ?? "",
    };
  });
  return xlsxResponse(`paiements-${new Date().toISOString().slice(0, 10)}.xlsx`, [{
    name: "Paiements",
    columns: [
      { header: "Date", key: "date" }, { header: "N° de reçu", key: "recu", width: 18 }, { header: "Matricule", key: "matricule" },
      { header: "Membre", key: "membre", width: 28 }, { header: "Type", key: "type" }, { header: "Période", key: "periode", width: 24 },
      { header: "Mode", key: "mode", width: 16 }, { header: "Opérateur", key: "operateur", width: 14 }, { header: "Référence", key: "reference", width: 18 },
      { header: "Montant (Ar)", key: "montant", width: 14 }, { header: "Statut", key: "statut" }, { header: "Motif d'annulation", key: "motif", width: 30 },
      { header: "Note", key: "note", width: 30 },
    ],
    rows,
  }]);
}
