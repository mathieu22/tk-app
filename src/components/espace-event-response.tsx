"use client";
// Réponse Participe / Ne participe pas / Peut-être pour un enfant (US-1.8).
import { Check, HelpCircle, X } from "lucide-react";
import { useState, useTransition } from "react";
import { respondToEvent } from "@/app/actions/events";

type EventResponse = "YES" | "NO" | "MAYBE";

const OPTIONS: { value: EventResponse; label: string; Icon: typeof Check; tone: string }[] = [
  { value: "YES", label: "Participe", Icon: Check, tone: "success" },
  { value: "NO", label: "Ne participe pas", Icon: X, tone: "danger" },
  { value: "MAYBE", label: "Peut-être", Icon: HelpCircle, tone: "warning" },
];

export function EspaceEventResponse({ eventId, memberId, childName, current, waitlistRank, minor, closed }: {
  eventId: string; memberId: string; childName: string; current: string | null; waitlistRank: number | null;
  minor: boolean; closed: boolean;
}) {
  const [response, setResponse] = useState(current);
  const [rank, setRank] = useState(waitlistRank);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const choose = (value: EventResponse) => {
    setError(null);
    start(async () => {
      const r = await respondToEvent(eventId, memberId, value, consent);
      if (!r.ok) return setError(r.error);
      setResponse(value);
      setRank(r.waitlistRank);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold">{childName}</span>
        {response === "YES" && rank !== null && <span className="gph-badge warning">Liste d&apos;attente</span>}
      </div>
      {closed ? (
        <span className="text-xs font-medium text-ink-3">
          Inscriptions closes{response ? ` · réponse : ${OPTIONS.find((o) => o.value === response)?.label ?? "en attente"}` : ""}
        </span>
      ) : (
        <>
          {minor && response !== "YES" && (
            <label className="flex items-start gap-2 text-xs font-medium text-ink-2">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--gph-primary)]" />
              J&apos;autorise mon enfant à participer à cet événement (autorisation parentale).
            </label>
          )}
          <div className="grid grid-cols-3 gap-1.5">
            {OPTIONS.map(({ value, label, Icon, tone }) => {
              const sel = response === value;
              return (
                <button key={value} type="button" disabled={pending} onClick={() => choose(value)} aria-pressed={sel}
                  className={`flex min-h-[44px] items-center justify-center gap-1 rounded-xl border px-1 text-xs font-semibold ${sel ? `gph-badge ${tone} border-transparent` : "border-divider bg-card text-ink-2"}`}>
                  <Icon size={13} strokeWidth={2.6} /> {label}
                </button>
              );
            })}
          </div>
        </>
      )}
      {error && <p role="alert" className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
