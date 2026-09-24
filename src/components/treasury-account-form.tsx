"use client";
// Création / modification d'un compte de trésorerie (US-6.1).
import { useActionState, useState } from "react";
import { saveAccount, toggleAccount } from "@/app/actions/treasury";
import { FormTopBar } from "@/components/ui";

const TYPES = { CASH: "Caisse (espèces)", MOBILE_MONEY: "Mobile Money", BANK: "Banque" };
const OPERATORS = { MVOLA: "MVola", ORANGE_MONEY: "Orange Money", AIRTEL_MONEY: "Airtel Money" };

export function AccountForm({ account }: {
  account?: { id: string; name: string; type: string; operator: string | null; openingBalance: number };
}) {
  const [state, action, pending] = useActionState(saveAccount, undefined);
  const v = state?.values ?? {};
  const e = state?.errors ?? {};
  const [type, setType] = useState(v.type ?? account?.type ?? "CASH");
  return (
    <form action={action}>
      <FormTopBar cancelHref="/tresorerie/comptes" title={account ? "Modifier le compte" : "Nouveau compte"} />
      {account && <input type="hidden" name="id" value={account.id} />}
      <input type="hidden" name="type" value={type} />
      <div className="mx-auto flex max-w-xl flex-col gap-3.5 px-4">
        <label className="block">
          <span className="gph-label">Nom</span>
          <input name="name" required maxLength={60} defaultValue={v.name ?? account?.name} className="gph-input" aria-invalid={!!e.name} />
          {e.name && <span className="mt-1.5 block text-xs font-semibold text-danger">{e.name}</span>}
        </label>
        <div>
          <span className="gph-label">Type</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TYPES).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setType(k)} aria-pressed={type === k} className={`gph-chip${type === k ? " active" : ""}`}>{label}</button>
            ))}
          </div>
        </div>
        {type === "MOBILE_MONEY" ? (
          <label className="block">
            <span className="gph-label">Opérateur</span>
            <select name="operator" defaultValue={v.operator ?? account?.operator ?? ""} className="gph-input" aria-invalid={!!e.operator}>
              <option value="" disabled>Choisir…</option>
              {Object.entries(OPERATORS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            {e.operator && <span className="mt-1.5 block text-xs font-semibold text-danger">{e.operator}</span>}
          </label>
        ) : <input type="hidden" name="operator" value="" />}
        <label className="block">
          <span className="gph-label">Solde de départ</span>
          <div className="relative">
            <input name="openingBalance" inputMode="numeric" defaultValue={v.openingBalance ?? account?.openingBalance ?? 0}
              className="gph-input gph-amount pr-12 font-bold" aria-invalid={!!e.openingBalance} />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-3">Ar</span>
          </div>
          {e.openingBalance && <span className="mt-1.5 block text-xs font-semibold text-danger">{e.openingBalance}</span>}
        </label>
        <button className="gph-btn-primary full mt-2" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</button>
      </div>
    </form>
  );
}

export function ToggleAccountButton({ id, active }: { id: string; active: boolean }) {
  const [pending, setPending] = useState(false);
  return (
    <button type="button" disabled={pending} className={`gph-btn-ghost !min-h-9 !px-3 !py-1.5 text-xs ${active ? "text-danger" : "text-primary"}`}
      onClick={async () => {
        if (active && !confirm("Désactiver ce compte ? Il ne sera plus proposé à la saisie ; son historique est conservé.")) return;
        setPending(true);
        try { await toggleAccount(id); } finally { setPending(false); }
      }}>
      {active ? "Désactiver" : "Réactiver"}
    </button>
  );
}
