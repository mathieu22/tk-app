"use client";
import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deleteCompetition } from "@/app/actions/palmares";

export function DeleteCompetitionButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="gph-icon-btn text-danger" disabled={pending} aria-label="Supprimer la compétition"
      onClick={() => confirm("Supprimer cette compétition ? Les résultats liés seront aussi supprimés.") && start(() => deleteCompetition(id))}>
      <Trash2 size={16} />
    </button>
  );
}
