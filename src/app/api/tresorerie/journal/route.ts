// Export Excel du journal des opérations, avec les filtres de la page (US-6.6).
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { xlsxResponse } from "@/lib/export";
import { formatDate } from "@/lib/format";
import { OPERATION_STATUS, OPERATION_TYPES } from "@/lib/treasury";
import { journalFilters } from "@/lib/treasury-filters";
import { treasuryReader } from "../auth";

export async function GET(req: NextRequest) {
  const { error, user } = await treasuryReader();
  if (error) return error;
  const { where } = journalFilters(Object.fromEntries(req.nextUrl.searchParams));
  const ops = await db.operation.findMany({
    where,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    take: 20_000,
    include: { account: true, transferAccount: true, category: true, payment: { select: { receiptNo: true } } },
  });
  await db.auditLog.create({ data: { userId: user.id, action: "treasury.export", entity: "Operation", details: `journal (${ops.length} lignes)` } });
  return xlsxResponse(`journal-tresorerie-${formatDate(new Date()).replaceAll("/", "-")}.xlsx`, [{
    name: "Journal",
    columns: [
      { header: "Date", key: "date", width: 12 }, { header: "Type", key: "type", width: 10 },
      { header: "Compte", key: "account", width: 16 }, { header: "Vers", key: "to", width: 16 },
      { header: "Catégorie", key: "category", width: 22 }, { header: "Tiers", key: "counterparty", width: 22 },
      { header: "Description", key: "description", width: 32 }, { header: "Montant (Ar)", key: "amount", width: 14 },
      { header: "Reçu", key: "receipt", width: 16 }, { header: "Statut", key: "status", width: 12 },
      { header: "Motif", key: "reason", width: 28 },
    ],
    rows: ops.map((o) => ({
      date: formatDate(o.date),
      type: OPERATION_TYPES[o.type as keyof typeof OPERATION_TYPES] ?? o.type,
      account: o.account.name,
      to: o.transferAccount?.name ?? "",
      category: o.category?.name ?? "",
      counterparty: o.counterparty ?? "",
      description: o.description ?? "",
      amount: o.type === "EXPENSE" ? -o.amount : o.amount,
      receipt: o.payment?.receiptNo ?? "",
      status: o.cancelled ? "Annulée" : OPERATION_STATUS[o.status as keyof typeof OPERATION_STATUS] ?? o.status,
      reason: o.cancelReason ?? "",
    })),
  }]);
}
