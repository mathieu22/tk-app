// Liste d'opérations : cartes sur téléphone, tableau sur ordinateur (§6 Responsive).
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CheckCircle2, Paperclip } from "lucide-react";
import Link from "next/link";
import { formatAriary, formatDate } from "@/lib/format";
import { OPERATION_STATUS } from "@/lib/treasury";

export type OpRow = {
  id: string; date: Date; type: string; amount: number; status: string; cancelled: boolean;
  description: string | null; counterparty: string | null; proofUrl: string | null; paymentId: string | null;
  account: { name: string }; transferAccount: { name: string } | null; category: { name: string } | null;
};

const TYPE = {
  INCOME: { Icon: ArrowDownLeft, color: "var(--gph-success-ink)", bg: "var(--gph-success-soft)", sign: "+" },
  EXPENSE: { Icon: ArrowUpRight, color: "var(--gph-danger-ink)", bg: "var(--gph-danger-soft)", sign: "−" },
  TRANSFER: { Icon: ArrowLeftRight, color: "var(--gph-finance)", bg: "#E3F2FD", sign: "" },
} as const;

function title(op: OpRow) {
  if (op.type === "TRANSFER") return `${op.account.name} → ${op.transferAccount?.name ?? "?"}`;
  return op.counterparty || op.description || op.category?.name || "Opération";
}

function StatusBadge({ op }: { op: OpRow }) {
  if (op.cancelled) return <span className="gph-badge neutral line-through">Annulée</span>;
  if (op.status === "PENDING") return <span className="gph-badge warning">À valider</span>;
  if (op.status === "REJECTED") return <span className="gph-badge danger">Rejetée</span>;
  return null;
}

export function OperationList({ ops, reconciled, empty = "Aucune opération." }: { ops: OpRow[]; reconciled?: Set<string>; empty?: string }) {
  if (!ops.length) return <div className="gph-card p-6 text-center text-sm text-ink-3">{empty}</div>;
  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {ops.map((op) => {
          const t = TYPE[op.type as keyof typeof TYPE] ?? TYPE.EXPENSE;
          return (
            <Link key={op.id} href={`/tresorerie/operations/${op.id}`} className={`gph-card flex items-center gap-3 p-3 ${op.cancelled || op.status === "REJECTED" ? "opacity-60" : ""}`}>
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl" style={{ background: t.bg, color: t.color }}>
                <t.Icon size={18} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{title(op)}</span>
                <span className="block truncate text-xs font-medium text-ink-3">
                  {formatDate(op.date)} · {op.type === "TRANSFER" ? "Virement" : `${op.category?.name ?? "—"} · ${op.account.name}`}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="gph-amount whitespace-nowrap text-sm font-bold" style={{ color: t.color }}>{t.sign}{formatAriary(op.amount)}</span>
                <StatusBadge op={op} />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="gph-card hidden overflow-hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-divider bg-bg text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">
            <tr>
              <th className="px-3 py-2.5">Date</th>
              <th className="px-3 py-2.5">Libellé</th>
              <th className="px-3 py-2.5">Catégorie</th>
              <th className="px-3 py-2.5">Compte</th>
              <th className="px-3 py-2.5 text-right">Montant</th>
              <th className="px-3 py-2.5">Statut</th>
            </tr>
          </thead>
          <tbody>
            {ops.map((op) => {
              const t = TYPE[op.type as keyof typeof TYPE] ?? TYPE.EXPENSE;
              return (
                <tr key={op.id} className={`border-b border-divider last:border-0 hover:bg-bg ${op.cancelled || op.status === "REJECTED" ? "opacity-60" : ""}`}>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">{formatDate(op.date)}</td>
                  <td className="max-w-64 px-3 py-2.5">
                    <Link href={`/tresorerie/operations/${op.id}`} className="flex items-center gap-1.5 font-semibold hover:text-primary">
                      <span className="truncate">{title(op)}</span>
                      {op.proofUrl && <Paperclip size={12} className="flex-none text-ink-3" aria-label="Justificatif" />}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">{op.type === "TRANSFER" ? "Virement interne" : op.category?.name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-ink-2">{op.account.name}</td>
                  <td className="gph-amount whitespace-nowrap px-3 py-2.5 text-right font-bold" style={{ color: t.color }}>
                    {t.sign}{formatAriary(op.amount)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <StatusBadge op={op} />
                      {!op.cancelled && op.status === "APPROVED" && <span className="text-xs text-ink-3">{OPERATION_STATUS.APPROVED}</span>}
                      {reconciled?.has(op.id) && <CheckCircle2 size={14} className="text-success" aria-label="Rapprochée" />}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export const OPERATION_INCLUDE = {
  account: { select: { name: true } },
  transferAccount: { select: { name: true } },
  category: { select: { name: true } },
} as const;
