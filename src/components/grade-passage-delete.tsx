"use client";
import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deletePassage } from "@/app/actions/grades";

/** Suppression d'un passage saisi par erreur (journalisée). */
export function GradePassageDelete({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="gph-icon-btn text-danger" disabled={pending} aria-label="Supprimer ce passage" title="Supprimer (correction)"
      onClick={() => confirm("Supprimer ce passage de grade ? (correction d'erreur)") && start(() => deletePassage(id))}>
      <Trash2 size={15} />
    </button>
  );
}
