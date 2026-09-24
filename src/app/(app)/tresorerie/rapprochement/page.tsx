import type { Metadata } from "next";
import { TreasuryTabs } from "@/components/treasury-tabs";
import { ScreenHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { ReconcileForm } from "./reconcile-form";

export const metadata: Metadata = { title: "Rapprochement bancaire" };

export default async function ReconcilePage() {
  const user = await requirePermission("treasury.manage");
  const [accounts, pending] = await Promise.all([
    db.treasuryAccount.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.operation.count({ where: { status: "PENDING", cancelled: false } }),
  ]);
  return (
    <>
      <ScreenHeader title="Rapprochement" sub="Import d'un relevé bancaire ou Mobile Money" />
      <div className="px-4">
        <TreasuryTabs active="rapprochement" user={user} pending={pending} />
        <ReconcileForm accounts={accounts} />
        <p className="mt-3 text-xs text-ink-3">
          Appariement automatique par montant identique à ± 3 jours. Le schéma n&apos;a pas de champ dédié : une opération
          « rapprochée » est marquée par une entrée du journal d&apos;audit (visible sur sa fiche et dans le journal, icône ✓).
        </p>
      </div>
    </>
  );
}
