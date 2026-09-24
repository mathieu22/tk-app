"use client";
// Actions interactives de la fiche membre (confirmations, QR partageable, comptes).
import { Printer, RefreshCw, Share2, Trash2, UserCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { archiveMember, createAthleteAccount, hardDeleteMember, inviteParent, regenerateQr } from "@/app/actions/members";

export function DeleteMemberButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="gph-btn-ghost flex-1" style={{ color: "var(--gph-danger)" }} disabled={pending}
      onClick={() => { if (confirm(`Archiver ${name} ? Son historique sera conservé.`)) start(() => archiveMember(id)); }}>
      <Trash2 size={15} /> {pending ? "Suppression…" : "Supprimer"}
    </button>
  );
}

/** Suppression définitive (administrateur) — double confirmation. */
export function HardDeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button type="button" disabled={pending} className="text-xs font-semibold text-danger underline-offset-2 hover:underline"
        onClick={() => {
          const typed = prompt(`Suppression DÉFINITIVE de ${name} : toutes ses données seront effacées.\nTapez SUPPRIMER pour confirmer.`);
          if (typed !== "SUPPRIMER") return;
          start(async () => { const r = await hardDeleteMember(id); if (r) setError(r.message); });
        }}>
        {pending ? "Suppression…" : "Supprimer définitivement"}
      </button>
      {error && <p className="mt-1 text-xs font-semibold text-danger" role="alert">{error}</p>}
    </div>
  );
}

export function RegenerateQrButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="gph-btn-ghost flex-1" disabled={pending}
      onClick={() => { if (confirm("Régénérer le QR code ? L'ancien ne fonctionnera plus.")) start(() => regenerateQr(id)); }}>
      <RefreshCw size={15} className={pending ? "animate-spin" : ""} /> Régénérer
    </button>
  );
}

/** Partage du QR (image PNG) via la feuille de partage native, sinon téléchargement. */
export function ShareQrButton({ pngDataUrl, filename, title }: { pngDataUrl: string; filename: string; title: string }) {
  return (
    <button type="button" className="gph-btn-ghost flex-1"
      onClick={async () => {
        const blob = await (await fetch(pngDataUrl)).blob();
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title }).catch(() => {});
        } else {
          const a = document.createElement("a");
          a.href = pngDataUrl;
          a.download = filename;
          a.click();
        }
      }}>
      <Share2 size={15} /> Partager
    </button>
  );
}

export function PrintButton({ label = "Imprimer" }: { label?: string }) {
  return (
    <button type="button" className="gph-btn-primary print:hidden" onClick={() => window.print()}>
      <Printer size={16} /> {label}
    </button>
  );
}

function ResultButton({ label, run }: { label: string; run: () => Promise<{ ok: boolean; message: string }> }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button type="button" disabled={pending} className="gph-btn-ghost w-full" onClick={() => start(async () => setMsg(await run()))}>
        <UserCheck size={15} /> {pending ? "…" : label}
      </button>
      {msg && <p role="status" className={`text-xs font-semibold ${msg.ok ? "text-primary" : "text-danger"}`}>{msg.message}</p>}
    </div>
  );
}

export function CreateAccountButton({ memberId }: { memberId: string }) {
  return <ResultButton label="Créer le compte athlète" run={() => createAthleteAccount(memberId)} />;
}

export function InviteParentButton({ parentId }: { parentId: string }) {
  return <ResultButton label="Inviter" run={() => inviteParent(parentId)} />;
}
