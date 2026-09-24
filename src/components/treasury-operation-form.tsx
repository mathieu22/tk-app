"use client";
// Saisie d'une recette, d'une dépense ou d'un virement interne (US-6.2 à 6.4).
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Info } from "lucide-react";
import { useActionState, useState } from "react";
import { createOperation } from "@/app/actions/treasury";
import { ImageInput } from "@/components/image-input";
import { FormTopBar } from "@/components/ui";

type Option = { id: string; name: string };
const TYPES = [
  { id: "INCOME", label: "Recette", Icon: ArrowDownLeft, color: "var(--gph-success)" },
  { id: "EXPENSE", label: "Dépense", Icon: ArrowUpRight, color: "var(--gph-danger)" },
  { id: "TRANSFER", label: "Virement", Icon: ArrowLeftRight, color: "var(--gph-finance)" },
] as const;

const fmt = (n: number) => `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ar`;

export function OperationForm({ initialType, accounts, categories, today, approvalMin, canApprove }: {
  initialType: string; accounts: Option[]; categories: (Option & { type: string })[];
  today: string; approvalMin: number; canApprove: boolean;
}) {
  const [state, action, pending] = useActionState(createOperation, undefined);
  const v = state?.values ?? {};
  const e = state?.errors ?? {};
  const [type, setType] = useState(v.type ?? initialType);
  const [amount, setAmount] = useState(v.amount ?? "");
  const cats = categories.filter((c) => c.type === type);
  const needsApproval = type === "EXPENSE" && Number(amount) > approvalMin && !canApprove;

  return (
    <form action={action}>
      <FormTopBar cancelHref="/tresorerie" title="Nouvelle opération" />
      <input type="hidden" name="type" value={type} />
      <div className="mx-auto flex max-w-2xl flex-col gap-3.5 px-4 pb-8">
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map(({ id, label, Icon, color }) => {
            const sel = type === id;
            return (
              <button key={id} type="button" onClick={() => setType(id)} aria-pressed={sel}
                className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-bold"
                style={{ background: sel ? color : "#fff", color: sel ? "#fff" : "var(--gph-ink)", border: sel ? "none" : "1px solid var(--gph-divider)" }}>
                <Icon size={20} strokeWidth={2.4} color={sel ? "#fff" : color} />
                {label}
              </button>
            );
          })}
        </div>

        <Field label="Montant" error={e.amount}>
          <div className="relative">
            <input name="amount" inputMode="numeric" required value={amount}
              onChange={(ev) => setAmount(ev.target.value.replace(/\D/g, ""))}
              className="gph-input gph-amount pr-12 text-[22px] font-bold text-finance" aria-invalid={!!e.amount} placeholder="0" />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-3">Ar</span>
          </div>
          {needsApproval && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--gph-warning-ink)]">
              <Info size={13} /> Au-delà de {fmt(approvalMin)} : la dépense devra être validée par le Président.
            </p>
          )}
        </Field>

        <div className="grid gap-3.5 md:grid-cols-2">
          <Field label={type === "TRANSFER" ? "Compte source" : type === "EXPENSE" ? "Compte débité" : "Compte crédité"} error={e.accountId}>
            <select name="accountId" required defaultValue={v.accountId ?? ""} className="gph-input">
              <option value="" disabled>Choisir…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          {type === "TRANSFER" ? (
            <Field label="Compte destination" error={e.transferAccountId}>
              <select name="transferAccountId" required defaultValue={v.transferAccountId ?? ""} className="gph-input">
                <option value="" disabled>Choisir…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Catégorie" error={e.categoryId}>
              <input type="hidden" name="transferAccountId" value="" />
              <select name="categoryId" required key={type} defaultValue={v.type === type ? v.categoryId ?? "" : ""} className="gph-input">
                <option value="" disabled>Choisir…</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        {type === "TRANSFER" && <input type="hidden" name="categoryId" value="" />}

        <div className="grid gap-3.5 md:grid-cols-2">
          <Field label="Date" error={e.date}>
            <input type="date" name="date" required max={today} defaultValue={v.date ?? today} className="gph-input" />
          </Field>
          <Field label={type === "EXPENSE" ? "Bénéficiaire" : type === "INCOME" ? "Tiers (donateur, sponsor…)" : "Référence"} optional error={e.counterparty}>
            <input name="counterparty" maxLength={120} defaultValue={v.counterparty} className="gph-input" />
          </Field>
        </div>

        <Field label="Description / note" optional error={e.description}>
          <textarea name="description" rows={2} maxLength={500} defaultValue={v.description} className="gph-input" />
        </Field>

        {type !== "TRANSFER" && (
          <div>
            <span className="gph-label">Justificatif <span className="opt">(photo de facture, reçu…)</span></span>
            <ImageInput name="proofUrl" maxSize={1024} label="Ajouter un justificatif" />
            {e.proofUrl && <p className="mt-1.5 text-center text-xs font-semibold text-danger">{e.proofUrl}</p>}
          </div>
        )}
        {type === "TRANSFER" && <input type="hidden" name="proofUrl" value="" />}

        {state?.message && <p role="alert" className="gph-badge danger justify-center py-2.5">{state.message}</p>}
        {Object.keys(e).length > 0 && <p role="alert" className="gph-badge danger justify-center py-2.5">Vérifiez les champs signalés.</p>}
        <button className="gph-btn-primary full" disabled={pending}>
          {pending ? "Enregistrement…" : needsApproval ? "Soumettre à validation" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, optional, error, children }: { label: string; optional?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="gph-label">{label} {optional && <span className="opt">(optionnel)</span>}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs font-semibold text-danger">{error}</span>}
    </label>
  );
}
