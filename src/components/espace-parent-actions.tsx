"use client";
// Actions de la fiche parent côté staff : invitation, association / dissociation d'athlètes.
import { Link2, Send, Unlink } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { inviteParent, linkChild, unlinkChild } from "@/app/actions/parents";

export function EspaceInviteButton({ parentId, again }: { parentId: string; again: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string | null } | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <button type="button" className="gph-btn-primary full" disabled={pending}
        onClick={() => start(async () => {
          const r = await inviteParent(parentId);
          setMsg(r.ok ? { ok: true, text: "Invitation envoyée par SMS.", link: r.link } : { ok: false, text: r.error });
        })}>
        <Send size={16} /> {pending ? "Envoi…" : again ? "Renvoyer l'invitation" : "Inviter"}
      </button>
      {msg && <p role="status" className={`text-xs font-semibold ${msg.ok ? "text-[var(--gph-success-ink)]" : "text-danger"}`}>{msg.text}</p>}
      {msg?.link && (
        <div className="rounded-xl bg-[var(--gph-warning-soft)] p-2.5 text-xs text-[var(--gph-warning-ink)]">
          Aucune passerelle SMS configurée : transmettez ce lien au parent.
          <a className="mt-1 block break-all font-semibold underline" href={`https://wa.me/?text=${encodeURIComponent(`Activez votre compte parent du club : ${msg.link}`)}`} target="_blank" rel="noopener noreferrer">
            Partager via WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}

export function EspaceUnlinkButton({ parentId, memberId, name }: { parentId: string; memberId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="gph-icon-btn text-danger" disabled={pending} aria-label={`Dissocier ${name}`}
      onClick={() => confirm(`Dissocier ${name} de ce parent ?`) && start(() => unlinkChild(parentId, memberId))}>
      <Unlink size={15} />
    </button>
  );
}

export function EspaceLinkChildForm({ parentId, members, relationships }: {
  parentId: string; members: { id: string; name: string }[]; relationships: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(linkChild.bind(null, parentId), undefined);
  if (!members.length) return null;
  return (
    <form action={action} className="gph-card mt-2 flex flex-col gap-2.5 p-3.5">
      <div className="text-[13px] font-bold">Associer un athlète</div>
      <select name="memberId" required className="gph-input" defaultValue="">
        <option value="" disabled>Choisir un athlète…</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2.5">
        <select name="relationship" defaultValue="MOTHER" className="gph-input" aria-label="Lien de parenté">
          {Object.entries(relationships).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select name="rank" defaultValue="1" className="gph-input" aria-label="Rang">
          <option value="1">Tuteur 1</option>
          <option value="2">Tuteur 2</option>
        </select>
      </div>
      {state?.error && <p className="text-xs font-semibold text-danger">{state.error}</p>}
      <button className="gph-btn-ghost w-full" disabled={pending}><Link2 size={15} /> Associer</button>
    </form>
  );
}
