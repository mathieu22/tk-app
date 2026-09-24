import type { Metadata } from "next";
import Link from "next/link";
import { ReviewButtons } from "@/components/treasury-actions";
import { TreasuryTabs } from "@/components/treasury-tabs";
import { ScreenHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { formatAriary, formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Dépenses à valider" };

export default async function PendingPage() {
  const user = await requirePermission("treasury.view");
  const [association, pending] = await Promise.all([
    getAssociation(),
    db.operation.findMany({
      where: { status: "PENDING", cancelled: false },
      orderBy: { date: "asc" },
      include: { account: true, category: true },
    }),
  ]);
  const approver = can(user, "expense.approve");
  return (
    <>
      <ScreenHeader title="À valider" sub={`Dépenses au-delà de ${formatAriary(association.expenseApprovalMin)}`} />
      <div className="px-4">
        <TreasuryTabs active="valider" user={user} pending={pending.length} />
        {!pending.length && <div className="gph-card p-6 text-center text-sm text-ink-3">Aucune dépense en attente.</div>}
        <div className="grid gap-3 lg:grid-cols-2">
          {pending.map((op) => (
            <div key={op.id} className="gph-card p-3.5">
              <div className="flex gap-3">
                {op.proofUrl && (
                  <a href={op.proofUrl} target="_blank" rel="noopener noreferrer" className="flex-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={op.proofUrl} alt="Justificatif" className="h-16 w-16 rounded-lg object-cover" />
                  </a>
                )}
                <Link href={`/tresorerie/operations/${op.id}`} className="min-w-0 flex-1">
                  <div className="gph-amount text-lg font-bold text-[var(--gph-danger-ink)]">−{formatAriary(op.amount)}</div>
                  <div className="truncate text-sm font-semibold">{op.counterparty || op.description || op.category?.name}</div>
                  <div className="text-xs text-ink-3">{formatDate(op.date)} · {op.category?.name} · {op.account.name}</div>
                  {!op.proofUrl && <div className="mt-1 text-xs font-semibold text-[var(--gph-warning-ink)]">Sans justificatif</div>}
                </Link>
              </div>
              {approver && <div className="mt-3"><ReviewButtons id={op.id} /></div>}
            </div>
          ))}
        </div>
        {!approver && pending.length > 0 && (
          <p className="mt-3 text-xs text-ink-3">La validation est réservée au Président (et à l&apos;administrateur).</p>
        )}
      </div>
    </>
  );
}
