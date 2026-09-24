import type { Metadata } from "next";
import { Card, SettingsHeader } from "@/components/settings-ui";
import { requirePermission } from "@/lib/dal";
import { BOARD_POSITIONS, MEMBER_STATUSES, POSITIONS, type Position } from "@/lib/domain";

export const metadata: Metadata = { title: "Statuts et postes" };

export default async function ListsPage() {
  await requirePermission("settings");
  return (
    <>
      <SettingsHeader title="Statuts et postes" sub="Valeurs des colonnes Statut et Poste de la fiche athlète" />
      <div className="grid gap-4 px-4 lg:grid-cols-2 lg:items-start">
        <Card title="Statuts">
          <ul className="flex flex-col gap-2 text-sm">
            {Object.entries(MEMBER_STATUSES).map(([k, label]) => (
              <li key={k} className="flex items-center justify-between">
                <span className="font-semibold">{label}</span>
                <span className="text-xs text-ink-3">{k === "ACTIVE" ? "Compté dans les séances et cotisations" : "Non compté"}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Postes">
          <ul className="flex flex-col gap-2 text-sm">
            {Object.entries(POSITIONS).map(([k, label]) => (
              <li key={k} className="flex items-center justify-between">
                <span className="font-semibold">{label}</span>
                {BOARD_POSITIONS.includes(k as Position) && <span className="gph-badge primary">Bureau · poste unique</span>}
              </li>
            ))}
          </ul>
        </Card>
        <p className="text-xs text-ink-3 lg:col-span-2">
          Ces listes sont fixées pour l&apos;instant (valeurs par défaut du cahier des charges). Leur modification nécessitera
          des tables dédiées : communiquez les valeurs utilisées dans votre fichier (question ouverte n°5) pour les ajuster.
        </p>
      </div>
    </>
  );
}
