"use client";
// Actions interactives de la fiche membre (confirmation de suppression, régénération du QR).
import { RefreshCw, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { archiveMember, regenerateQr } from "@/app/actions/members";

export function DeleteMemberButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="gph-btn-ghost flex-1"
      style={{ color: "var(--gph-danger)" }}
      disabled={pending}
      onClick={() => {
        if (confirm(`Archiver ${name} ? Son historique sera conservé.`)) start(() => archiveMember(id));
      }}
    >
      <Trash2 size={15} /> {pending ? "Suppression…" : "Supprimer"}
    </button>
  );
}

export function RegenerateQrButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="gph-btn-ghost flex-1"
      disabled={pending}
      onClick={() => {
        if (confirm("Régénérer le QR code ? L'ancien ne fonctionnera plus.")) start(() => regenerateQr(id));
      }}
    >
      <RefreshCw size={15} className={pending ? "animate-spin" : ""} /> Régénérer
    </button>
  );
}
