import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelOperationButton, ReviewButtons } from "@/components/treasury-actions";
import { BackButton } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { formatAriary, formatDate, formatPhone } from "@/lib/format";
import { can } from "@/lib/permissions";
import { OPERATION_STATUS, OPERATION_TYPES, RECONCILE_ACTION } from "@/lib/treasury";

export const metadata: Metadata = { title: "Opération" };

const PROFILE: Record<string, string> = { ADMIN: "Administrateur", PRESIDENT: "Président", SECRETARY: "Secrétaire", TREASURER: "Trésorier", COACH: "Encadrant" };
const ACTIONS: Record<string, string> = {
  "treasury.operation.create": "Saisie", "treasury.expense.approve": "Validation", "treasury.expense.reject": "Rejet",
  "treasury.operation.cancel": "Annulation", "treasury.reconcile": "Rapprochement",
};
const dateTime = (d: Date) => `${formatDate(d)} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

export default async function OperationPage(props: PageProps<"/tresorerie/operations/[id]">) {
  const user = await requirePermission("treasury.view");
  const { id } = await props.params;
  const op = await db.operation.findUnique({
    where: { id },
    include: { account: true, transferAccount: true, category: true, payment: { include: { member: true } } },
  });
  if (!op) notFound();

  const history = await db.auditLog.findMany({ where: { entity: "Operation", entityId: id }, orderBy: { at: "asc" } });
  const userIds = [...new Set([op.recordedById, op.approvedById, ...history.map((h) => h.userId)].filter((x): x is string => !!x))];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, phone: true, profile: true } });
  const who = (uid: string | null) => {
    const u = users.find((x) => x.id === uid);
    return u ? `${PROFILE[u.profile] ?? u.profile} (${formatPhone(u.phone)})` : "—";
  };
  const sign = op.type === "INCOME" ? "+" : op.type === "EXPENSE" ? "−" : "";
  const color = op.type === "INCOME" ? "var(--gph-success-ink)" : op.type === "EXPENSE" ? "var(--gph-danger-ink)" : "var(--gph-finance)";
  const status = op.cancelled ? "Annulée" : OPERATION_STATUS[op.status as keyof typeof OPERATION_STATUS] ?? op.status;
  const reconciled = history.some((h) => h.action === RECONCILE_ACTION);

  const rows: [string, React.ReactNode][] = [
    ["Type", OPERATION_TYPES[op.type as keyof typeof OPERATION_TYPES] ?? op.type],
    ["Date", formatDate(op.date)],
    [op.type === "TRANSFER" ? "Compte source" : "Compte", op.account.name],
    ...(op.type === "TRANSFER" ? [["Compte destination", op.transferAccount?.name ?? "—"] as [string, React.ReactNode]] : []),
    ...(op.category ? [["Catégorie", op.category.name] as [string, React.ReactNode]] : []),
    ...(op.counterparty ? [[op.type === "EXPENSE" ? "Bénéficiaire" : "Tiers", op.counterparty] as [string, React.ReactNode]] : []),
    ...(op.description ? [["Description", op.description] as [string, React.ReactNode]] : []),
    ["Statut", status + (reconciled ? " · rapprochée" : "")],
    ["Saisie", `${who(op.recordedById)} · ${dateTime(op.createdAt)}`],
    ...(op.approvedById && op.approvedAt && !op.paymentId
      ? [[op.status === "REJECTED" ? "Rejetée par" : "Validée par", `${who(op.approvedById)} · ${dateTime(op.approvedAt)}`] as [string, React.ReactNode]]
      : []),
    ...(op.cancelReason ? [[op.cancelled ? "Motif d'annulation" : "Motif du rejet", op.cancelReason] as [string, React.ReactNode]] : []),
  ];

  return (
    <>
      <div className="flex items-center px-4 pb-2 pt-1.5">
        <BackButton href="/tresorerie/operations" />
      </div>
      <div className="mx-auto max-w-2xl px-4">
        <div className="gph-card mb-3.5 p-5 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-3">{OPERATION_TYPES[op.type as keyof typeof OPERATION_TYPES]}</div>
          <div className={`gph-amount mt-1 text-[30px] font-bold ${op.cancelled ? "line-through opacity-60" : ""}`} style={{ color }}>
            {sign}{formatAriary(op.amount)}
          </div>
          {op.status === "PENDING" && !op.cancelled && <span className="gph-badge warning mt-2">En attente de validation</span>}
          {op.status === "REJECTED" && <span className="gph-badge danger mt-2">Rejetée</span>}
          {op.cancelled && <span className="gph-badge neutral mt-2">Annulée</span>}
        </div>

        <div className="gph-card mb-3.5 p-0">
          {rows.map(([k, v], i) => (
            <div key={k} className={`flex items-baseline justify-between gap-4 px-4 py-2.5 ${i ? "border-t border-divider" : ""}`}>
              <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">{k}</span>
              <span className="text-right text-sm font-semibold">{v}</span>
            </div>
          ))}
        </div>

        {op.payment && (
          <Link href={`/cotisations/paiement/${op.payment.id}`} className="gph-card mb-3.5 flex items-center gap-3 p-3.5">
            <span className="flex-1 text-sm">
              <span className="block font-semibold">Reçu {op.payment.receiptNo}</span>
              <span className="text-xs text-ink-3">Cotisation de {op.payment.member.firstName} {op.payment.member.lastName} — enregistrée automatiquement</span>
            </span>
            <ExternalLink size={16} className="text-primary" />
          </Link>
        )}

        {op.proofUrl && (
          <div className="gph-card mb-3.5 p-3">
            <div className="gph-label">Justificatif</div>
            <a href={op.proofUrl} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={op.proofUrl} alt="Justificatif" className="max-h-96 w-full rounded-xl object-contain" />
            </a>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {op.status === "PENDING" && !op.cancelled && can(user, "expense.approve") && <ReviewButtons id={op.id} />}
          {!op.cancelled && op.status !== "REJECTED" && can(user, "treasury.manage") && (
            op.paymentId
              ? <p className="text-center text-xs text-ink-3">Recette de cotisation : pour l&apos;annuler, annulez le paiement dans Cotisations.</p>
              : <CancelOperationButton id={op.id} />
          )}
        </div>

        {history.length > 0 && (
          <div className="mt-5">
            <div className="gph-label">Historique</div>
            <ol className="flex flex-col gap-1.5 text-xs text-ink-2">
              {history.map((h) => (
                <li key={h.id}>
                  <span className="font-semibold">{dateTime(h.at)}</span> · {who(h.userId)} · {ACTIONS[h.action] ?? h.action}{h.details ? ` — ${h.details}` : ""}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </>
  );
}
