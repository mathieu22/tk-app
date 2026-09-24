"use client";
import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deleteResult } from "@/app/actions/palmares";

export function DeleteResultButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="gph-icon-btn flex-none text-danger" disabled={pending} aria-label="Supprimer ce résultat"
      onClick={() => confirm("Supprimer ce résultat ?") && start(() => deleteResult(id))}>
      <Trash2 size={14} />
    </button>
  );
}
