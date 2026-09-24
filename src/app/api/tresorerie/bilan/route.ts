// Bilan mensuel / annuel (compte de résultat simplifié) en PDF ou Excel — US-6.6.
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAssociation } from "@/lib/dal";
import { PdfWriter, xlsxResponse } from "@/lib/export";
import { formatAriary, formatDate } from "@/lib/format";
import { accountBalances, incomeStatement } from "@/lib/treasury";
import { reportPeriod } from "@/lib/treasury-filters";
import { treasuryReader } from "../auth";

export async function GET(req: NextRequest) {
  const { error, user } = await treasuryReader();
  if (error) return error;
  const association = await getAssociation();
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const p = reportPeriod(sp, association.currentSchoolYear, association.schoolYearStartMon);
  const [statement, opening, closing] = await Promise.all([
    incomeStatement(p.from, p.to),
    accountBalances({ until: p.from, includeInactive: true }),
    accountBalances({ until: p.to, includeInactive: true }),
  ]);
  const slug = `bilan-${p.mois || p.annee}`;
  await db.auditLog.create({ data: { userId: user.id, action: "treasury.export", entity: "Report", details: `${slug} ${sp.format ?? "pdf"}` } });

  if (sp.format === "xlsx") {
    return xlsxResponse(`${slug}.xlsx`, [
      {
        name: "Compte de résultat",
        columns: [{ header: "Type", key: "type", width: 12 }, { header: "Catégorie", key: "name", width: 32 }, { header: "Montant (Ar)", key: "amount", width: 16 }],
        rows: [
          ...statement.income.map((l) => ({ type: "Recette", ...l })),
          { type: "Recette", name: "TOTAL RECETTES", amount: statement.totalIncome },
          ...statement.expense.map((l) => ({ type: "Dépense", ...l })),
          { type: "Dépense", name: "TOTAL DÉPENSES", amount: statement.totalExpense },
          { type: "", name: "RÉSULTAT", amount: statement.result },
        ],
      },
      {
        name: "Soldes des comptes",
        columns: [{ header: "Compte", key: "name", width: 24 }, { header: "Début (Ar)", key: "start", width: 16 }, { header: "Fin (Ar)", key: "end", width: 16 }],
        rows: closing.map((a) => ({ name: a.name, start: opening.find((o) => o.id === a.id)?.balance ?? 0, end: a.balance })),
      },
    ]);
  }

  const pdf = await PdfWriter.create();
  pdf.text(association.name, { size: 16, bold: true });
  if (association.address) pdf.text(association.address, { size: 9, color: [0.45, 0.47, 0.55] });
  pdf.gap(6);
  pdf.text(`Bilan ${p.kind} — ${p.label}`, { size: 13, bold: true });
  pdf.text(`Du ${formatDate(p.from)} au ${formatDate(new Date(p.to.getTime() - 86400e3))} · édité le ${formatDate(new Date())}`, { size: 9, color: [0.45, 0.47, 0.55] });
  pdf.gap(8);
  pdf.text("Recettes", { bold: true });
  pdf.table(["Catégorie", "Montant"], [...statement.income.map((l) => [l.name, formatAriary(l.amount)]), ["Total recettes", formatAriary(statement.totalIncome)]], [345, 150]);
  pdf.gap(8);
  pdf.text("Dépenses", { bold: true });
  pdf.table(["Catégorie", "Montant"], [...statement.expense.map((l) => [l.name, formatAriary(l.amount)]), ["Total dépenses", formatAriary(statement.totalExpense)]], [345, 150]);
  pdf.gap(8);
  pdf.keyValue("Résultat de la période", formatAriary(statement.result));
  pdf.gap(10);
  pdf.text("Soldes des comptes", { bold: true });
  pdf.table(
    ["Compte", "Début de période", "Fin de période"],
    closing.map((a) => [a.name, formatAriary(opening.find((o) => o.id === a.id)?.balance ?? 0), formatAriary(a.balance)]),
    [215, 140, 140],
  );
  pdf.gap(10);
  pdf.text("Opérations validées et non annulées ; virements internes sans effet sur le résultat.", { size: 8, color: [0.45, 0.47, 0.55] });
  return pdf.response(`${slug}.pdf`);
}
