"use client";
// Éditeurs du référentiel des grades (US-4.1).
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { moveGrade, saveGrade, saveGrid, saveMapping, toggleGradeActive } from "@/app/actions/grades";
import { BELT_COLORS, BeltBadge } from "@/components/belt-badge";

export type GradeRow = {
  id: string; gridId: string; kind: string; number: number; beltLabel: string; mainColor: string; stripeColor: string | null;
  stripeCount: number; poomsae: string | null; drawRule: string | null; minMonths: number; minAge: number | null;
  minAttendance: number | null; active: boolean;
};

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs font-semibold text-danger">{msg}</p> : null;
}

function ColorSelect({ name, value, onChange, allowNone }: { name: string; value: string; onChange: (v: string) => void; allowNone?: boolean }) {
  return (
    <select name={name} value={value} onChange={(e) => onChange(e.target.value)} className="gph-input py-2.5">
      {allowNone && <option value="">—</option>}
      {Object.entries(BELT_COLORS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
    </select>
  );
}

export function GradeForm({ grade, gridId, onDone }: { grade?: GradeRow; gridId: string; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveGrade, undefined);
  const [main, setMain] = useState(grade?.mainColor ?? "white");
  const [stripe, setStripe] = useState(grade?.stripeColor ?? "");
  const [count, setCount] = useState(grade?.stripeCount ?? 0);
  const [kind, setKind] = useState(grade?.kind ?? "KEUP");
  const done = useRef(onDone);
  useEffect(() => { if (state?.ok) done.current?.(); }, [state]);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="grid gap-3 rounded-xl bg-bg p-3 sm:grid-cols-2">
      {grade && <input type="hidden" name="id" value={grade.id} />}
      <input type="hidden" name="gridId" value={gridId} />
      <div className="flex items-center gap-3 sm:col-span-2">
        <BeltBadge grade={{ mainColor: main, stripeColor: stripe || null, stripeCount: stripe ? count : 0, kind }} width={96} height={22} />
        <span className="text-xs text-ink-3">Aperçu du badge</span>
      </div>
      <div>
        <label className="gph-label">Type</label>
        <select name="kind" value={kind} onChange={(ev) => setKind(ev.target.value)} className="gph-input py-2.5">
          <option value="KEUP">Keup</option><option value="POOM">Poom</option><option value="DAN">Dan</option>
        </select>
      </div>
      <div>
        <label className="gph-label">Numéro</label>
        <input name="number" type="number" min={1} max={20} required defaultValue={grade?.number} className="gph-input py-2.5" />
        <Err msg={e.number} />
      </div>
      <div className="sm:col-span-2">
        <label className="gph-label">Libellé de ceinture</label>
        <input name="beltLabel" required maxLength={80} defaultValue={grade?.beltLabel} className="gph-input py-2.5" />
        <Err msg={e.beltLabel} />
      </div>
      <div>
        <label className="gph-label">Couleur principale</label>
        <ColorSelect name="mainColor" value={main} onChange={setMain} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="gph-label">Barrettes</label>
          <ColorSelect name="stripeColor" value={stripe} onChange={setStripe} allowNone />
        </div>
        <div>
          <label className="gph-label">Nombre</label>
          <select name="stripeCount" value={stripe ? count : 0} onChange={(ev) => setCount(Number(ev.target.value))} className="gph-input py-2.5">
            <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option>
          </select>
        </div>
      </div>
      <div>
        <label className="gph-label">Poomsae exigé</label>
        <input name="poomsae" maxLength={200} defaultValue={grade?.poomsae ?? ""} className="gph-input py-2.5" />
      </div>
      <div>
        <label className="gph-label">Règle de tirage</label>
        <input name="drawRule" maxLength={200} defaultValue={grade?.drawRule ?? ""} placeholder="2 poomsae au choix (tirage)" className="gph-input py-2.5" />
      </div>
      <div>
        <label className="gph-label">Durée min. (mois)</label>
        <input name="minMonths" type="number" min={0} max={120} defaultValue={grade?.minMonths ?? 6} className="gph-input py-2.5" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="gph-label">Âge min.</label>
          <input name="minAge" type="number" min={0} max={99} defaultValue={grade?.minAge ?? ""} className="gph-input py-2.5" />
        </div>
        <div>
          <label className="gph-label">Présence min. %</label>
          <input name="minAttendance" type="number" min={0} max={100} defaultValue={grade?.minAttendance ?? ""} className="gph-input py-2.5" />
        </div>
      </div>
      {state?.error && <p className="text-xs font-semibold text-danger sm:col-span-2">{state.error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button className="gph-btn-primary flex-1" disabled={pending}>Enregistrer</button>
        {onDone && <button type="button" className="gph-btn-ghost" onClick={onDone}>Fermer</button>}
      </div>
    </form>
  );
}

export function GradeRowItem({ grade, first, last }: { grade: GradeRow; first: boolean; last: boolean }) {
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="border-b border-divider py-2.5 last:border-none">
      <div className="flex items-center gap-2.5" style={{ opacity: grade.active ? 1 : 0.5 }}>
        <BeltBadge grade={grade} width={52} height={14} title={grade.beltLabel} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {grade.number}{grade.number === 1 ? "er" : "e"} {grade.kind.toLowerCase()} — {grade.beltLabel}
          </div>
          <div className="truncate text-xs text-ink-3">
            {grade.poomsae ?? "Pas de poomsae"}{grade.drawRule && ` + ${grade.drawRule}`} · {grade.minMonths} mois
            {grade.minAge ? ` · ${grade.minAge} ans min.` : ""}{grade.minAttendance ? ` · ${grade.minAttendance} % présence` : ""}
            {!grade.active && " · désactivé"}
          </div>
        </div>
        <div className="flex flex-none gap-1">
          <button className="gph-icon-btn" disabled={pending || first} onClick={() => start(() => moveGrade(grade.id, "up"))} aria-label="Monter"><ArrowUp size={14} /></button>
          <button className="gph-icon-btn" disabled={pending || last} onClick={() => start(() => moveGrade(grade.id, "down"))} aria-label="Descendre"><ArrowDown size={14} /></button>
          <button className="gph-icon-btn" disabled={pending} onClick={() => start(() => toggleGradeActive(grade.id))} aria-label={grade.active ? "Désactiver" : "Activer"}>
            {grade.active ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button className="gph-icon-btn" onClick={() => setEdit(!edit)} aria-label="Modifier"><Pencil size={14} /></button>
        </div>
      </div>
      {edit && <div className="mt-2"><GradeForm grade={grade} gridId={grade.gridId} onDone={() => setEdit(false)} /></div>}
    </div>
  );
}

export function AddGrade({ gridId }: { gridId: string }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="mt-2"><GradeForm gridId={gridId} onDone={() => setOpen(false)} /></div>
  ) : (
    <button className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-primary" onClick={() => setOpen(true)}>
      <Plus size={15} /> Ajouter un grade
    </button>
  );
}

export function GridForm({ grid }: { grid?: { id: string; name: string; ageMin: number | null; ageMax: number | null } }) {
  const [state, action, pending] = useActionState(saveGrid, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      {grid && <input type="hidden" name="id" value={grid.id} />}
      <div className="min-w-[140px] flex-1">
        <label className="gph-label">Nom</label>
        <input name="name" required defaultValue={grid?.name} className="gph-input py-2.5" />
      </div>
      <div className="w-24">
        <label className="gph-label">Âge min.</label>
        <input name="ageMin" type="number" min={0} defaultValue={grid?.ageMin ?? ""} className="gph-input py-2.5" />
      </div>
      <div className="w-24">
        <label className="gph-label">Âge max.</label>
        <input name="ageMax" type="number" min={0} defaultValue={grid?.ageMax ?? ""} className="gph-input py-2.5" />
      </div>
      <button className="gph-btn-ghost" disabled={pending}>{grid ? "Enregistrer" : "Créer la grille"}</button>
      {(state?.errors?.name || state?.ok) && (
        <p className={`w-full text-xs font-semibold ${state.ok ? "text-primary" : "text-danger"}`}>{state.errors?.name ?? state.ok}</p>
      )}
    </form>
  );
}

export function MappingSelect({ childId, value, options }: { childId: string; value: string; options: { id: string; label: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <select defaultValue={value} disabled={pending} className="gph-input py-2 text-[13px]"
      onChange={(e) => { const v = e.target.value; start(() => saveMapping(childId, v)); }}>
      <option value="">— Aucune —</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}
