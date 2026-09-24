import { Download, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OPERATION_INCLUDE, OperationList } from "@/components/treasury-operations";
import { TreasuryTabs } from "@/components/treasury-tabs";
import { ScreenHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { formatAriary } from "@/lib/format";
import { can } from "@/lib/permissions";
import { COUNTED, OPERATION_TYPES, reconciledIds } from "@/lib/treasury";
import { journalFilters } from "@/lib/treasury-filters";

export const metadata: Metadata = { title: "Journal de trésorerie" };

const PAGE = 100;

export default async function JournalPage(props: PageProps<"/tresorerie/operations">) {
  const user = await requirePermission("treasury.view");
  const sp = await props.searchParams;
  const { f, where } = journalFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);

  const [accounts, categories, ops, count, totals, pending] = await Promise.all([
    db.treasuryAccount.findMany({ orderBy: { name: "asc" } }),
    db.operationCategory.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
    db.operation.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: PAGE, skip: (page - 1) * PAGE, include: OPERATION_INCLUDE }),
    db.operation.count({ where }),
    db.operation.groupBy({ by: ["type"], where: { AND: [where, COUNTED] }, _sum: { amount: true } }),
    db.operation.count({ where: { status: "PENDING", cancelled: false } }),
  ]);
  const reconciled = await reconciledIds(ops.map((o) => o.id));
  const sum = (t: string) => totals.find((x) => x.type === t)?._sum.amount ?? 0;
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();

  return (
    <>
      <ScreenHeader
        title="Journal"
        sub={`${count} opération${count > 1 ? "s" : ""}`}
        action={can(user, "treasury.manage") && (
          <Link href="/tresorerie/nouvelle?type=EXPENSE" className="gph-btn-primary"><Plus size={16} strokeWidth={2.5} /> Opération</Link>
        )}
      />
      <div className="px-4">
        <TreasuryTabs active="journal" user={user} pending={pending} />

        <form className="gph-card mb-3.5 grid grid-cols-2 gap-2.5 p-3.5 md:grid-cols-4">
          <div className="relative col-span-2">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input name="q" defaultValue={f.q} placeholder="Libellé, tiers…" className="gph-input with-icon" aria-label="Recherche" />
          </div>
          <select name="compte" defaultValue={f.compte} className="gph-input" aria-label="Compte">
            <option value="">Tous les comptes</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select name="type" defaultValue={f.type} className="gph-input" aria-label="Type">
            <option value="">Tous les types</option>
            {Object.entries(OPERATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="categorie" defaultValue={f.categorie} className="gph-input" aria-label="Catégorie">
            <option value="">Toutes les catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.type === "INCOME" ? "Recette" : "Dépense"} · {c.name}</option>)}
          </select>
          <select name="statut" defaultValue={f.statut} className="gph-input" aria-label="Statut">
            <option value="">Tous les statuts</option>
            <option value="APPROVED">Validées</option>
            <option value="PENDING">À valider</option>
            <option value="REJECTED">Rejetées</option>
            <option value="CANCELLED">Annulées</option>
          </select>
          <label className="text-xs font-semibold text-ink-3">Du<input type="date" name="du" defaultValue={f.du} className="gph-input mt-1" /></label>
          <label className="text-xs font-semibold text-ink-3">Au<input type="date" name="au" defaultValue={f.au} className="gph-input mt-1" /></label>
          <div className="col-span-2 flex gap-2 md:col-span-4">
            <button className="gph-btn-primary flex-1">Filtrer</button>
            <Link href="/tresorerie/operations" className="gph-btn-ghost">Réinitialiser</Link>
            <a href={`/api/tresorerie/journal?${qs}`} className="gph-btn-ghost" aria-label="Exporter en Excel"><Download size={16} /> Excel</a>
          </div>
        </form>

        <div className="mb-3.5 grid grid-cols-3 gap-2 text-center">
          <div className="gph-card p-2.5"><div className="text-[11px] font-semibold text-ink-3">Recettes</div><div className="gph-amount text-sm font-bold text-[var(--gph-success-ink)]">+{formatAriary(sum("INCOME"))}</div></div>
          <div className="gph-card p-2.5"><div className="text-[11px] font-semibold text-ink-3">Dépenses</div><div className="gph-amount text-sm font-bold text-[var(--gph-danger-ink)]">−{formatAriary(sum("EXPENSE"))}</div></div>
          <div className="gph-card p-2.5"><div className="text-[11px] font-semibold text-ink-3">Résultat</div><div className="gph-amount text-sm font-bold">{formatAriary(sum("INCOME") - sum("EXPENSE"))}</div></div>
        </div>

        <OperationList ops={ops} reconciled={reconciled} empty="Aucune opération pour ces filtres." />

        {count > PAGE && (
          <div className="mt-3.5 flex items-center justify-center gap-3 text-sm font-semibold">
            {page > 1 && <Link href={`/tresorerie/operations?${qs}&page=${page - 1}`} className="gph-btn-ghost">Précédent</Link>}
            <span className="text-ink-3">Page {page} / {Math.ceil(count / PAGE)}</span>
            {page * PAGE < count && <Link href={`/tresorerie/operations?${qs}&page=${page + 1}`} className="gph-btn-ghost">Suivant</Link>}
          </div>
        )}
      </div>
    </>
  );
}
