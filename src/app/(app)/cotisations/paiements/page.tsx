import { Download, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { BackButton } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { FEE_META, fullName, PAYMENT_METHODS, type FeeCode, type PaymentMethod } from "@/lib/domain";
import { formatAriary, formatDate } from "@/lib/format";
import { periodLabel } from "../data";
import { EmptyList } from "../status-row";
import { findPayments, parseFilters, whereFor } from "./query";

export const metadata: Metadata = { title: "Historique des paiements" };

const PAGE = 50;

export default async function PaymentsHistory({ searchParams }: PageProps<"/cotisations/paiements">) {
  await requirePermission("payment.viewAll");
  const sp = await searchParams;
  const f = parseFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const [payments, count, sum] = await Promise.all([
    findPayments(f, PAGE, (page - 1) * PAGE),
    db.payment.count({ where: whereFor(f) }),
    db.payment.aggregate({ where: { AND: [whereFor(f), { cancelled: false }] }, _sum: { totalAmount: true } }),
  ]);
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...f, ...patch }).filter(([, v]) => v !== ""));
    return `?${p}`;
  };
  const exportHref = `/api/cotisations/paiements${qs({})}`;

  const rows = payments.map((p) => {
    const dues = p.allocations.map((a) => a.due);
    const ft = dues[0]?.feeType;
    const meta = ft && ft.code in FEE_META ? FEE_META[ft.code as FeeCode] : null;
    return {
      p, meta, feeLabel: ft?.label ?? "—",
      period: ft?.code === "EVENT" ? (dues[0].event?.title ?? "Événement") : periodLabel(dues),
      method: PAYMENT_METHODS[p.method as PaymentMethod]?.label ?? p.method,
      name: fullName(p.member),
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-1.5">
        <BackButton href="/cotisations" />
        <a href={exportHref} className="gph-btn-ghost !min-h-9 !py-2 text-[13px]">
          <Download size={15} /> Excel
        </a>
      </div>
      <div className="px-5 pb-3 pt-2">
        <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Historique des paiements</h1>
        <div className="mt-0.5 text-xs font-semibold text-ink-3">
          {count} paiement{count > 1 ? "s" : ""} · <span className="gph-amount">{formatAriary(sum._sum.totalAmount ?? 0)}</span> encaissés
        </div>
      </div>

      <form className="grid grid-cols-2 gap-2 px-4 pb-3 lg:grid-cols-6">
        <div className="relative col-span-2">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input name="q" type="search" defaultValue={f.q} placeholder="Membre, reçu, référence" className="gph-input with-icon" />
        </div>
        <select name="type" defaultValue={f.type} className="gph-input" aria-label="Type de frais">
          <option value="">Tous les types</option>
          {(Object.keys(FEE_META) as FeeCode[]).map((c) => <option key={c} value={FEE_META[c].slug}>{c === "EVENT" ? "Événement" : c === "ECOLAGE" ? "Écolage" : c === "DROIT" ? "Droit" : "Passport"}</option>)}
        </select>
        <select name="mode" defaultValue={f.mode} className="gph-input" aria-label="Mode de paiement">
          <option value="">Tous les modes</option>
          {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => <option key={m} value={m}>{PAYMENT_METHODS[m].label}</option>)}
        </select>
        <input name="du" type="date" defaultValue={f.du} className="gph-input" aria-label="Du" />
        <input name="au" type="date" defaultValue={f.au} className="gph-input" aria-label="Au" />
        <select name="annules" defaultValue={f.annules} className="gph-input col-span-2 lg:col-span-1" aria-label="Paiements annulés">
          <option value="exclure">Sans les annulés</option>
          <option value="inclure">Avec les annulés</option>
          <option value="seuls">Annulés seulement</option>
        </select>
        <button className="gph-btn-primary col-span-2 lg:col-span-1">Filtrer</button>
      </form>

      <div className="px-4 pb-4">
        {rows.length === 0 && <EmptyList>Aucun paiement pour ces critères.</EmptyList>}

        {/* Téléphone : cartes */}
        <div className="flex flex-col gap-2 lg:hidden">
          {rows.map(({ p, meta, feeLabel, period, method, name }) => (
            <Link key={p.id} href={`/cotisations/paiement/${p.id}`} className={`gph-card flex items-center gap-3 p-2.5 ${p.cancelled ? "opacity-60" : ""}`}>
              <Avatar name={name} size={36} photoUrl={p.member.photoUrl} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{name}</div>
                <div className="truncate text-[11px] font-medium text-ink-3">
                  <span className="font-bold" style={{ color: meta?.color }}>{feeLabel}</span> · {period} · {formatDate(p.date)} · {method}
                </div>
                {p.cancelled && <div className="truncate text-[11px] font-semibold text-[var(--gph-danger-ink)]">Annulé : {p.cancelReason}</div>}
              </div>
              <div className={`gph-amount text-[13px] font-bold ${p.cancelled ? "text-ink-3 line-through" : ""}`}>{formatAriary(p.totalAmount)}</div>
            </Link>
          ))}
        </div>

        {/* Ordinateur : tableau */}
        {rows.length > 0 && (
          <div className="gph-card hidden overflow-hidden p-0 lg:block">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-bg text-[11px] uppercase tracking-[0.03em] text-ink-3">
                <tr>
                  {["Date", "Reçu", "Membre", "Type", "Période", "Mode", "Référence", "Montant"].map((h) => (
                    <th key={h} className={`px-3 py-2.5 font-semibold ${h === "Montant" ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, meta, feeLabel, period, method, name }) => (
                  <tr key={p.id} className={`border-t border-divider ${p.cancelled ? "text-ink-3" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-2.5">{formatDate(p.date)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      <Link href={`/cotisations/paiement/${p.id}`} className="text-primary hover:underline">{p.receiptNo}</Link>
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{name}</td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: meta?.color }}>{feeLabel}</td>
                    <td className="px-3 py-2.5">{period}</td>
                    <td className="px-3 py-2.5">{method}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{p.reference ?? "—"}</td>
                    <td className={`gph-amount whitespace-nowrap px-3 py-2.5 text-right font-bold ${p.cancelled ? "line-through" : ""}`}
                      title={p.cancelled ? `Annulé : ${p.cancelReason ?? ""}` : undefined}>
                      {formatAriary(p.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {count > PAGE && (
          <div className="mt-3 flex items-center justify-between text-sm font-semibold">
            {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="text-primary">← Précédents</Link> : <span />}
            <span className="text-ink-3">Page {page} / {Math.ceil(count / PAGE)}</span>
            {page * PAGE < count ? <Link href={qs({ page: String(page + 1) })} className="text-primary">Suivants →</Link> : <span />}
          </div>
        )}
      </div>
    </div>
  );
}
