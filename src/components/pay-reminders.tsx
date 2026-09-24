"use client";
// Liste des relances (US-3.6) : WhatsApp / SMS pré-rédigés par membre, envoi groupé via la passerelle.
import { MessageCircle, MessageSquare, Send } from "lucide-react";
import { useActionState, useState } from "react";
import { sendReminders } from "@/app/actions/payments";
import { Avatar } from "@/components/avatar";
import { formatAriary } from "@/lib/format";

type Row = {
  memberId: string; name: string; photoUrl: string | null; total: number; details: string;
  recipientName: string; recipientRole: string; phone: string | null; message: string;
};

export function ReminderList({ rows, canSend }: { rows: Row[]; canSend: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(sendReminders, undefined);
  const all = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (rows.length === 0) {
    return <div className="mx-4 gph-card p-5 text-center text-sm text-ink-3">Aucun retard de cotisation. 🎉</div>;
  }

  return (
    <form action={action} className="px-4 pb-28 md:pb-4">
      {canSend && (
        <label className="mb-2.5 flex items-center gap-2 px-1 text-[13px] font-semibold text-ink-2">
          <input type="checkbox" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.memberId)))}
            className="h-4 w-4 accent-[var(--gph-primary)]" />
          Tout sélectionner
        </label>
      )}
      <div className="grid gap-2 lg:grid-cols-2">
        {rows.map((r) => {
          const digits = r.phone?.replace(/\D/g, "") ?? "";
          const text = encodeURIComponent(r.message);
          return (
            <div key={r.memberId} className="gph-card flex items-start gap-3 p-3">
              {canSend && (
                <input type="checkbox" name="memberId" value={r.memberId} checked={selected.has(r.memberId)} onChange={() => toggle(r.memberId)}
                  aria-label={`Sélectionner ${r.name}`} className="mt-3 h-4 w-4 flex-none accent-[var(--gph-primary)]" />
              )}
              <Avatar name={r.name} size={40} photoUrl={r.photoUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="truncate text-sm font-semibold">{r.name}</div>
                  <div className="gph-amount flex-none text-[13px] font-bold text-[var(--gph-danger-ink)]">{formatAriary(r.total)}</div>
                </div>
                <div className="text-xs font-medium text-ink-3">{r.details}</div>
                <div className="mt-1 text-[11px] font-semibold text-ink-2">
                  {r.recipientRole} : {r.recipientName}{r.phone ? ` · ${r.phone}` : " · pas de téléphone"}
                </div>
                {r.phone && (
                  <div className="mt-2 flex gap-2">
                    <a href={`https://wa.me/${digits}?text=${text}`} target="_blank" rel="noopener noreferrer" className="gph-chip !py-1.5">
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                    <a href={`sms:${r.phone.replace(/\s/g, "")}?body=${text}`} className="gph-chip !py-1.5">
                      <MessageSquare size={14} /> SMS
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canSend && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 border-t border-divider bg-card px-4 py-3 md:static md:mt-3 md:border-none md:bg-transparent md:p-0">
          {state?.sent !== undefined && (
            <p role="status" className="gph-badge success mb-2 w-full justify-center py-2">
              {state.sent} relance{state.sent > 1 ? "s" : ""} envoyée{state.sent > 1 ? "s" : ""} via la passerelle
            </p>
          )}
          {state?.error && <p role="alert" className="gph-badge danger mb-2 w-full justify-center py-2">{state.error}</p>}
          <button className="gph-btn-primary full" disabled={pending || selected.size === 0}>
            <Send size={16} /> {pending ? "Envoi…" : `Envoyer via la passerelle (${selected.size})`}
          </button>
        </div>
      )}
    </form>
  );
}
