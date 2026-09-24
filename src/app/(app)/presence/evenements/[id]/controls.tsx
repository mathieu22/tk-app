"use client";
import { AlertTriangle, Ban, Bell, RotateCcw, Search, Trash2, UserMinus, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { addParticipant, cancelEvent, deleteEvent, remindNonResponders, removeParticipant, respondToEvent, setEventAttendance } from "@/app/actions/events";

type Status = "PRESENT" | "ABSENT";

/** Correction manuelle d'une présence (staff, US-1.10). */
export function EventAttendanceMenu({ eventDayId, memberId, status }: { eventDayId: string; memberId: string; status: Status }) {
  const [pending, start] = useTransition();
  const other: Status = status === "PRESENT" ? "ABSENT" : "PRESENT";
  return (
    <button disabled={pending} onClick={() => start(() => setEventAttendance(eventDayId, memberId, other))}
      className="gph-chip" title={other === "PRESENT" ? "Marquer présent" : "Marquer absent"}>
      {other === "PRESENT" ? "Présent ?" : "Absent ?"}
    </button>
  );
}

export function RemoveParticipantButton({ eventId, memberId }: { eventId: string; memberId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="relative">
      <button disabled={pending} aria-label="Retirer" title="Retirer l'inscription"
        onClick={() => {
          if (!confirm("Retirer ce participant ?")) return;
          start(async () => {
            const r = await removeParticipant(eventId, memberId);
            setError(r.error ?? null);
          });
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-bg hover:text-danger">
        <UserMinus size={16} />
      </button>
      {error && <div className="gph-badge danger absolute right-0 top-9 z-10 whitespace-nowrap">{error}</div>}
    </div>
  );
}

export function ReminderButton({ eventId }: { eventId: string }) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState<number | null>(null);
  return (
    <button disabled={pending} className="gph-btn-ghost"
      onClick={() => start(async () => setSent((await remindNonResponders(eventId)).sent))}>
      <Bell size={15} /> {sent === null ? "Envoyer un rappel" : `${sent} rappel${sent > 1 ? "s" : ""} envoyé${sent > 1 ? "s" : ""}`}
    </button>
  );
}

export function CancelEventButton({ eventId, cancelled }: { eventId: string; cancelled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className="gph-icon-btn" disabled={pending} aria-label={cancelled ? "Rétablir l'événement" : "Annuler l'événement"}
      title={cancelled ? "Rétablir l'événement" : "Annuler l'événement"}
      onClick={() => {
        if (!cancelled && !confirm("Annuler cet événement ? Les inscriptions et l'historique sont conservés.")) return;
        start(() => cancelEvent(eventId, !cancelled));
      }}>
      {cancelled ? <RotateCcw size={16} /> : <Ban size={16} />}
    </button>
  );
}

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="relative">
      <button className="gph-icon-btn text-danger" disabled={pending} aria-label="Supprimer l'événement" title="Supprimer l'événement"
        onClick={() => {
          if (!confirm("Supprimer définitivement cet événement ? Cette action est irréversible.")) return;
          start(async () => {
            const r = await deleteEvent(eventId);
            if (r?.error) setError(r.error);
          });
        }}>
        <Trash2 size={16} />
      </button>
      {error && (
        <div className="gph-card absolute right-0 top-10 z-10 flex w-64 items-start gap-2 p-3 text-xs font-semibold text-danger">
          <AlertTriangle size={14} className="mt-0.5 flex-none" /> {error}
        </div>
      )}
    </div>
  );
}

/** Inscrire un membre non inscrit (staff, US-1.8). */
export function AddParticipant({ eventId, candidates }: { eventId: string; candidates: { id: string; name: string; role: string }[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const filtered = candidates.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30);
  const close = () => {
    setOpen(false);
    setQ("");
  };
  return (
    <div className="relative">
      <button className="gph-btn-ghost" onClick={() => (open ? close() : setOpen(true))}>
        <UserPlus size={15} /> Ajouter
      </button>
      {open && (
        <div className="gph-card absolute left-0 top-11 z-10 w-72 p-2.5">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un membre" className="gph-input with-icon py-2" />
          </div>
          <div className="flex max-h-56 flex-col overflow-y-auto">
            {filtered.map((c) => (
              <button key={c.id} disabled={pending} className="flex items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-bg"
                onClick={() => start(async () => {
                  await addParticipant(eventId, c.id);
                  close();
                })}>
                <span className="text-sm font-semibold">{c.name}</span>
                <span className="text-xs text-ink-3">{c.role}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="py-3 text-center text-xs text-ink-3">Aucun résultat.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Réponse d'un athlète / parent (US-1.8), utilisée aussi par l'espace parents. */
export function RespondButtons({ eventId, memberId, current, isMinor, compact }: {
  eventId: string; memberId: string; current: string; isMinor?: boolean; compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);

  const respond = (response: "YES" | "NO" | "MAYBE", consent = false) => {
    start(async () => {
      const r = await respondToEvent(eventId, memberId, response, consent);
      if (!r.ok) {
        if (isMinor && response === "YES" && !consent) setNeedsConsent(true);
        else setError(r.error);
      } else {
        setError(null);
        setNeedsConsent(false);
      }
    });
  };

  if (needsConsent) {
    return (
      <div className="gph-card p-3 text-sm">
        <p className="mb-2 font-semibold">Autorisation parentale requise pour un mineur.</p>
        <label className="mb-2 flex items-center gap-2 text-xs text-ink-2">
          <input type="checkbox" id={`consent-${memberId}`} className="h-4 w-4 accent-[var(--gph-primary)]" />
          J&apos;autorise la participation de mon enfant.
        </label>
        <div className="flex gap-2">
          <button className="gph-btn-ghost flex-1" onClick={() => setNeedsConsent(false)}>Annuler</button>
          <button className="gph-btn-primary flex-1" disabled={pending}
            onClick={() => respond("YES", (document.getElementById(`consent-${memberId}`) as HTMLInputElement)?.checked)}>
            Confirmer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`flex gap-1.5 ${compact ? "" : "flex-wrap"}`}>
        {([["YES", "Participe"], ["MAYBE", "Peut-être"], ["NO", "Ne participe pas"]] as const).map(([v, label]) => (
          <button key={v} disabled={pending} onClick={() => respond(v)}
            className={`gph-chip${current === v ? " active" : ""}`}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
