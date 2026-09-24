"use client";
// Saisie en lot des résultats (US-5.2) : catégorie d'âge / de poids proposées automatiquement.
import { AlertTriangle, Plus, Search, Trash2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { saveResults, type FormState } from "@/app/actions/palmares";
import { ImageInput } from "@/components/image-input";
import { DISCIPLINES, type Discipline, type Fight, OUTCOMES, type Outcome } from "../../labels";

export type MemberOpt = {
  id: string; name: string; sex: "M" | "F";
  proposal: { ageCategory: string | null; weightCategory: string | null; nearLimit: boolean; staleWeighIn: boolean; poomsae: string[] | null } | null;
};

type Row = {
  memberId: string; name: string; discipline: Discipline; sex: "M" | "F"; ageCategory: string; weightCategory: string;
  weighInKg: string; outcome: Outcome; rank: string; score: string; teamName: string; observation: string; photoUrl: string; fights: Fight[];
  poomsaeAllowed: string[] | null; nearLimit: boolean; staleWeighIn: boolean;
};

const emptyRow = (m: MemberOpt): Row => ({
  memberId: m.id, name: m.name, discipline: "KYORUGI", sex: m.sex, ageCategory: m.proposal?.ageCategory ?? "",
  weightCategory: m.proposal?.weightCategory ?? "", weighInKg: "", outcome: "PARTICIPATION", rank: "", score: "",
  teamName: "", observation: "", photoUrl: "", fights: [],
  poomsaeAllowed: m.proposal?.poomsae ?? null, nearLimit: m.proposal?.nearLimit ?? false, staleWeighIn: m.proposal?.staleWeighIn ?? false,
});

export function ResultsEditor({ competitionId, members }: { competitionId: string; members: MemberOpt[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveResults.bind(null, competitionId), undefined);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const used = useMemo(() => new Set(rows.map((r) => r.memberId)), [rows]);
  const matches = q.trim().length < 2 ? [] : members.filter((m) => !used.has(m.id) && m.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ajouter un athlète" className="gph-input with-icon" />
      </div>
      {matches.length > 0 && (
        <div className="gph-card flex flex-col p-1">
          {matches.map((m) => (
            <button type="button" key={m.id} className="rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-bg"
              onClick={() => { setRows((rs) => [...rs, emptyRow(m)]); setQ(""); }}>
              {m.name}
            </button>
          ))}
        </div>
      )}

      {rows.map((r, i) => (
        <fieldset key={r.memberId} className="gph-card p-3.5">
          <input type="hidden" name={`results[${i}].memberId`} value={r.memberId} />
          <input type="hidden" name={`results[${i}].sex`} value={r.sex} />
          <input type="hidden" name={`results[${i}].details`} value={JSON.stringify(r.fights)} />
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold">{r.name}</span>
            <button type="button" className="gph-icon-btn text-danger" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} aria-label="Retirer">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="gph-label">Épreuve</label>
              <select name={`results[${i}].discipline`} value={r.discipline} onChange={(e) => update(i, { discipline: e.target.value as Discipline })} className="gph-input py-2 text-[13px]">
                {Object.entries(DISCIPLINES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="gph-label">Résultat</label>
              <select name={`results[${i}].outcome`} value={r.outcome} onChange={(e) => update(i, { outcome: e.target.value as Outcome })} className="gph-input py-2 text-[13px]">
                {Object.entries(OUTCOMES).map(([v, o]) => <option key={v} value={v}>{o.emoji ? `${o.emoji} ` : ""}{o.label}</option>)}
              </select>
            </div>
          </div>
          {r.outcome === "RANK" && (
            <div className="mt-2 w-24">
              <label className="gph-label">Rang</label>
              <input name={`results[${i}].rank`} type="number" min={1} value={r.rank} onChange={(e) => update(i, { rank: e.target.value })} className="gph-input py-2 text-[13px]" />
            </div>
          )}
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div>
              <label className="gph-label">Catégorie d&apos;âge</label>
              <input name={`results[${i}].ageCategory`} value={r.ageCategory} onChange={(e) => update(i, { ageCategory: e.target.value })} className="gph-input py-2 text-[13px]" />
            </div>
            {r.discipline === "KYORUGI" && (
              <>
                <div>
                  <label className="gph-label">Catégorie de poids</label>
                  <input name={`results[${i}].weightCategory`} value={r.weightCategory} onChange={(e) => update(i, { weightCategory: e.target.value })} className="gph-input py-2 text-[13px]" />
                </div>
                <div>
                  <label className="gph-label">Poids de pesée (kg)</label>
                  <input name={`results[${i}].weighInKg`} type="number" step="0.1" value={r.weighInKg} onChange={(e) => update(i, { weighInKg: e.target.value })} className="gph-input py-2 text-[13px]" />
                </div>
              </>
            )}
          </div>
          {(r.nearLimit || r.staleWeighIn) && r.discipline === "KYORUGI" && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--gph-warning-ink)]">
              <AlertTriangle size={12} />
              {r.nearLimit && "Poids proche d'une limite de catégorie. "}
              {r.staleWeighIn && "Dernière pesée trop ancienne."}
            </p>
          )}
          {r.discipline !== "KYORUGI" && (
            <div className="mt-2">
              <label className="gph-label">Note poomsae <span className="opt">(optionnel)</span></label>
              <input name={`results[${i}].score`} value={r.score} onChange={(e) => update(i, { score: e.target.value })} maxLength={30} className="gph-input py-2 text-[13px]" />
              {r.poomsaeAllowed && <p className="mt-1 text-[11px] text-ink-3">Poomsae autorisés : {r.poomsaeAllowed.join(", ")}</p>}
            </div>
          )}
          {(r.discipline === "POOMSAE_PAIR" || r.discipline === "POOMSAE_TEAM") && (
            <div className="mt-2">
              <label className="gph-label">Nom de l&apos;équipe <span className="opt">(optionnel)</span></label>
              <input name={`results[${i}].teamName`} value={r.teamName} onChange={(e) => update(i, { teamName: e.target.value })} maxLength={120} className="gph-input py-2 text-[13px]" />
            </div>
          )}
          {r.discipline === "KYORUGI" && (
            <FightsEditor fights={r.fights} onChange={(fights) => update(i, { fights })} />
          )}
          <div className="mt-2">
            <label className="gph-label">Observation <span className="opt">(optionnel)</span></label>
            <input name={`results[${i}].observation`} value={r.observation} onChange={(e) => update(i, { observation: e.target.value })} maxLength={1000} className="gph-input py-2 text-[13px]" />
          </div>
          <div className="mt-2">
            <label className="gph-label">Photo <span className="opt">(optionnel)</span></label>
            <ImageInput name={`results[${i}].photoUrl`} maxSize={1000} />
          </div>
        </fieldset>
      ))}
      {rows.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3">Ajoutez un athlète pour saisir un résultat.</div>}

      {state?.error && <p role="alert" className="gph-badge danger justify-center py-2.5 text-[13px]">{state.error}</p>}
      {state?.ok && <p role="status" className="gph-badge success justify-center py-2.5 text-[13px]">{state.ok}</p>}
      {rows.length > 0 && <button className="gph-btn-primary full" disabled={pending}>Enregistrer les résultats</button>}
    </form>
  );
}

function FightsEditor({ fights, onChange }: { fights: Fight[]; onChange: (f: Fight[]) => void }) {
  return (
    <div className="mt-2">
      <label className="gph-label">Combats <span className="opt">(optionnel)</span></label>
      <div className="flex flex-col gap-1.5">
        {fights.map((f, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5">
            <input placeholder="Adversaire" value={f.opponent} onChange={(e) => onChange(fights.map((x, idx) => idx === i ? { ...x, opponent: e.target.value } : x))} className="gph-input py-1.5 text-[12px]" />
            <input placeholder="Score" value={f.score} onChange={(e) => onChange(fights.map((x, idx) => idx === i ? { ...x, score: e.target.value } : x))} className="gph-input py-1.5 text-[12px]" />
            <input placeholder="Tour" value={f.round} onChange={(e) => onChange(fights.map((x, idx) => idx === i ? { ...x, round: e.target.value } : x))} className="gph-input py-1.5 text-[12px]" />
            <button type="button" className="gph-icon-btn" onClick={() => onChange(fights.filter((_, idx) => idx !== i))} aria-label="Retirer">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-primary"
        onClick={() => onChange([...fights, { opponent: "", score: "", round: "" }])}>
        <Plus size={13} /> Ajouter un combat
      </button>
    </div>
  );
}
