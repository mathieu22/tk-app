"use client";
import { Lock, LockOpen, MoreHorizontal } from "lucide-react";
import { useTransition } from "react";
import { setAttendance, toggleSessionClosed } from "@/app/actions/sessions";

type Status = "PRESENT" | "ABSENT" | "EXCUSED";
const LABELS: Record<Status, string> = { PRESENT: "Marquer présent", ABSENT: "Marquer absent", EXCUSED: "Marquer excusé" };

/** Correction manuelle d'un statut (journalisée côté serveur). */
export function AttendanceMenu({ sessionId, memberId, status }: { sessionId: string; memberId: string; status: Status }) {
  const [pending, start] = useTransition();
  return (
    <details className="relative">
      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-ink-3 hover:bg-bg" aria-label="Corriger le statut">
        <MoreHorizontal size={18} />
      </summary>
      <div className="gph-card absolute right-0 top-10 z-10 flex w-48 flex-col p-1">
        {(Object.keys(LABELS) as Status[]).filter((s) => s !== status).map((s) => (
          <button key={s} disabled={pending}
            onClick={(e) => {
              (e.currentTarget.closest("details") as HTMLDetailsElement).open = false;
              start(() => setAttendance(sessionId, memberId, s));
            }}
            className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold hover:bg-bg">
            {LABELS[s]}
          </button>
        ))}
      </div>
    </details>
  );
}

export function CloseSessionButton({ sessionId, open }: { sessionId: string; open: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className="gph-icon-btn" disabled={pending} aria-label={open ? "Clôturer la séance" : "Rouvrir la séance"}
      title={open ? "Clôturer la séance" : "Rouvrir la séance"}
      onClick={() => {
        if (open && !confirm("Clôturer la séance ? Plus aucun scan ne sera possible.")) return;
        start(() => toggleSessionClosed(sessionId));
      }}>
      {open ? <Lock size={16} /> : <LockOpen size={16} />}
    </button>
  );
}
