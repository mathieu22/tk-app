"use client";
// Candidats, tirage au sort et saisie des résultats en lot (US-4.4).
import { Dices, Lock, Trash2, UserPlus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import {
  addCandidates, closeExam, drawCandidatePoomsae, removeCandidate, saveExamResults, setCandidateTarget, type FormState,
} from "@/app/actions/grades";
import { BeltBadge } from "@/components/belt-badge";

type Belt = { mainColor: string; stripeColor: string | null; stripeCount: number; kind: string };
export type CandidateRow = {
  id: string; name: string; current: string | null; targetId: string; target: Belt & { label: string; poomsae: string | null; drawRule: string | null };
  drawn: string | null; scores: Record<string, string>; result: string; note: string | null;
};
export type Eligible = {
  id: string; name: string; current: string | null; next: string | null; eligible: boolean; reasons: string[];
  duesOk: boolean; attendancePct: number | null;
};

const TESTS: [string, string][] = [["poomsae", "Poomsae"], ["kibon", "Kibon"], ["kyorugi", "Kyorugi"], ["kyukpa", "Kyukpa"], ["theorie", "Théorie"]];

export function CandidatePicker({ examId, members }: { examId: string; members: Eligible[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [onlyEligible, setOnlyEligible] = useState(true);
  const [pending, start] = useTransition();
  const shown = members.filter((m) => !onlyEligible || (m.eligible && m.duesOk));
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink-2">
        <input type="checkbox" checked={onlyEligible} onChange={(e) => setOnlyEligible(e.target.checked)} />
        Seulement les éligibles (durée, âge, présence, cotisations à jour)
      </label>
      <div className="flex max-h-80 flex-col overflow-y-auto">
        {shown.map((m) => (
          <label key={m.id} className="flex items-center gap-3 border-b border-divider py-2 last:border-none">
            <input type="checkbox" checked={selected.includes(m.id)}
              onChange={(e) => setSelected((s) => (e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id)))} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{m.name}</span>
              <span className="block truncate text-xs text-ink-3">{m.current ?? "Aucun grade"} → {m.next ?? "—"}</span>
            </span>
            <span className="flex flex-none flex-wrap justify-end gap-1">
              {m.eligible ? <span className="gph-badge success">Éligible</span> : m.reasons.map((r) => <span key={r} className="gph-badge warning">{r}</span>)}
              {!m.duesOk && <span className="gph-badge danger">Cotisations</span>}
              {m.attendancePct !== null && <span className="gph-badge neutral">{m.attendancePct} %</span>}
            </span>
          </label>
        ))}
        {shown.length === 0 && <p className="py-4 text-center text-sm text-ink-3">Aucun athlète.</p>}
      </div>
      <button className="gph-btn-primary full mt-3" disabled={pending || !selected.length}
        onClick={() => start(async () => { await addCandidates(examId, selected); setSelected([]); })}>
        <UserPlus size={16} /> Convoquer {selected.length || ""} candidat{selected.length > 1 ? "s" : ""}
      </button>
    </div>
  );
}

export function ResultsForm({ examId, candidates, closed, external, gradeOptions }: {
  examId: string; candidates: CandidateRow[]; closed: boolean; external: boolean; gradeOptions: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveExamResults.bind(null, examId), undefined);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) => start(async () => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Erreur."); }
  });

  return (
    <form action={action} className="flex flex-col gap-3">
      {candidates.map((c) => (
        <fieldset key={c.id} disabled={closed} className="gph-card p-3.5">
          <div className="flex items-start gap-3">
            <BeltBadge grade={c.target} width={44} height={12} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{c.name}</div>
              <div className="text-xs text-ink-3">Actuel : {c.current ?? "aucun grade"}</div>
            </div>
            {!closed && (
              <button type="button" className="gph-icon-btn text-danger" aria-label="Retirer" onClick={() => run(() => removeCandidate(c.id))}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <div>
              <label className="gph-label">Grade visé</label>
              <select defaultValue={c.targetId} className="gph-input py-2 text-[13px]" onChange={(e) => { const v = e.target.value; run(() => setCandidateTarget(c.id, v)); }}>
                {gradeOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div className="text-xs text-ink-2">
              <div className="gph-label">Poomsae exigé</div>
              <div className="font-semibold">{c.target.poomsae ?? "—"}</div>
              {c.target.drawRule && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {c.drawn ? <span className="gph-badge primary whitespace-normal">Tirage : {c.drawn}</span> : <span className="text-ink-3">+ {c.target.drawRule}</span>}
                  {!closed && !c.drawn && (
                    <button type="button" className="gph-chip py-1" onClick={() => run(() => drawCandidatePoomsae(c.id))}>
                      <Dices size={13} /> Tirer au sort
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {!external && (
            <div className="mt-2.5 grid grid-cols-5 gap-1.5">
              {TESTS.map(([k, label]) => (
                <div key={k}>
                  <label className="block truncate text-[10px] font-bold uppercase text-ink-3">{label}</label>
                  <input name={`${c.id}.${k}`} defaultValue={c.scores[k] ?? ""} maxLength={20} className="gph-input px-2 py-2 text-center text-[13px]" />
                </div>
              ))}
            </div>
          )}
          <div className="mt-2.5 grid gap-2 sm:grid-cols-[auto_1fr]">
            <div className="flex gap-1.5">
              {[["PASSED", "Admis"], ["FAILED", "Ajourné"], ["PENDING", "En attente"]].map(([v, l]) => (
                <label key={v} className="gph-chip has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-white">
                  <input type="radio" name={`${c.id}.result`} value={v} defaultChecked={c.result === v} className="sr-only" /> {l}
                </label>
              ))}
            </div>
            <input name={`${c.id}.note`} defaultValue={c.note ?? ""} maxLength={300}
              placeholder={external ? "N° de certificat Kukkiwon" : "Appréciation"} className="gph-input py-2 text-[13px]" />
          </div>
        </fieldset>
      ))}
      {candidates.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3">Aucun candidat convoqué.</div>}
      {(state?.error || error) && <p role="alert" className="gph-badge danger justify-center py-2.5 text-[13px]">{state?.error ?? error}</p>}
      {state?.ok && <p role="status" className="gph-badge success justify-center py-2.5 text-[13px]">{state.ok}</p>}
      {!closed && candidates.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="gph-btn-primary flex-1" disabled={pending || busy}>Enregistrer les résultats</button>
          <button type="button" className="gph-btn-ghost flex-1" disabled={pending || busy}
            onClick={() => confirm("Clôturer l'examen ? Les grades des admis seront mis à jour.") && run(() => closeExam(examId))}>
            <Lock size={15} /> Clôturer et mettre à jour les grades
          </button>
        </div>
      )}
    </form>
  );
}
