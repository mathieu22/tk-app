"use client";
// Éditeurs du référentiel fédéral par saison (US-5.5).
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  createSeason, deleteAgeCategory, deleteAllowedPoomsae, deleteWeightCategory, duplicateSeason,
  saveAgeCategory, saveAllowedPoomsae, saveWeightCategory,
} from "@/app/actions/palmares";

export function SeasonForm() {
  const [state, action, pending] = useActionState(createSeason, undefined);
  const year = new Date().getFullYear() + 1;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="w-24">
        <label className="gph-label">Année</label>
        <input name="year" type="number" defaultValue={year} className="gph-input py-2 text-[13px]" />
      </div>
      <div className="min-w-[140px] flex-1">
        <label className="gph-label">Libellé</label>
        <input name="label" defaultValue={`Saison ${year}`} className="gph-input py-2 text-[13px]" />
      </div>
      <button className="gph-btn-ghost" disabled={pending}><Plus size={14} /> Créer</button>
      {state?.errors?.year && <p className="w-full text-xs font-semibold text-danger">{state.errors.year}</p>}
    </form>
  );
}

export function DuplicateSeasonButton({ seasonId, nextYear }: { seasonId: string; nextYear: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button className="gph-chip" disabled={pending}
        onClick={() => { setError(null); start(async () => { try { await duplicateSeason(seasonId); } catch (e) { setError(e instanceof Error ? e.message : "Erreur."); } }); }}>
        <Copy size={13} /> Dupliquer vers {nextYear}
      </button>
      {error && <p className="mt-1 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}

type WeightRow = { id: string; sex: string; label: string; maxKg: number | null };

export function WeightList({ ageCategoryId, weights }: { ageCategoryId: string; weights: WeightRow[] }) {
  const [adding, setAdding] = useState<"M" | "F" | null>(null);
  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      {(["M", "F"] as const).map((sex) => (
        <div key={sex}>
          <div className="mb-1 text-[11px] font-bold uppercase text-ink-3">{sex === "M" ? "Garçons" : "Filles"}</div>
          <div className="flex flex-wrap gap-1.5">
            {weights.filter((w) => w.sex === sex).map((w) => <WeightChip key={w.id} ageCategoryId={ageCategoryId} weight={w} />)}
          </div>
          {adding === sex ? (
            <WeightForm ageCategoryId={ageCategoryId} sex={sex} onDone={() => setAdding(null)} />
          ) : (
            <button className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => setAdding(sex)}>
              <Plus size={12} /> Ajouter
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function WeightChip({ ageCategoryId, weight }: { ageCategoryId: string; weight: WeightRow }) {
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  if (edit) return <WeightForm ageCategoryId={ageCategoryId} weight={weight} onDone={() => setEdit(false)} />;
  return (
    <span className="gph-chip">
      {weight.label}
      <button type="button" onClick={() => setEdit(true)} aria-label="Modifier"><Pencil size={11} /></button>
      <button type="button" disabled={pending} onClick={() => start(() => deleteWeightCategory(weight.id))} aria-label="Supprimer"><Trash2 size={11} /></button>
    </span>
  );
}

function WeightForm({ ageCategoryId, sex, weight, onDone }: { ageCategoryId: string; sex?: string; weight?: WeightRow; onDone: () => void }) {
  const [state, action] = useActionState(saveWeightCategory, undefined);
  const done = useRef(onDone);
  useEffect(() => { if (state?.ok) done.current(); }, [state]);
  return (
    <form action={action} className="mt-1.5 flex items-center gap-1.5">
      {weight && <input type="hidden" name="id" value={weight.id} />}
      <input type="hidden" name="ageCategoryId" value={ageCategoryId} />
      <input type="hidden" name="sex" value={weight?.sex ?? sex} />
      <input name="label" defaultValue={weight?.label} placeholder="-45 kg" required maxLength={20} className="gph-input w-20 py-1.5 text-xs" />
      <input name="maxKg" type="number" step="0.1" defaultValue={weight?.maxKg ?? ""} placeholder="max" className="gph-input w-16 py-1.5 text-xs" />
      <button className="gph-icon-btn h-7 w-7"><Plus size={12} /></button>
      <button type="button" onClick={onDone} className="text-xs text-ink-3">Annuler</button>
    </form>
  );
}

type AgeCatRow = { id: string; name: string; ageMin: number; ageMax: number | null };

export function AgeCategoryForm({ seasonId, category, onDone }: { seasonId: string; category?: AgeCatRow; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveAgeCategory, undefined);
  const done = useRef(onDone);
  useEffect(() => { if (state?.ok && done.current) done.current(); }, [state]);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      {category && <input type="hidden" name="id" value={category.id} />}
      <input type="hidden" name="seasonId" value={seasonId} />
      <div className="min-w-[120px] flex-1">
        <label className="gph-label">Nom</label>
        <input name="name" required maxLength={40} defaultValue={category?.name} className="gph-input py-2 text-[13px]" />
      </div>
      <div className="w-20">
        <label className="gph-label">Âge min.</label>
        <input name="ageMin" type="number" required defaultValue={category?.ageMin} className="gph-input py-2 text-[13px]" />
      </div>
      <div className="w-20">
        <label className="gph-label">Âge max.</label>
        <input name="ageMax" type="number" defaultValue={category?.ageMax ?? ""} className="gph-input py-2 text-[13px]" />
      </div>
      <button className="gph-btn-ghost" disabled={pending}>{category ? "Enregistrer" : "Ajouter"}</button>
      {state?.errors?.name && <p className="w-full text-xs font-semibold text-danger">{state.errors.name}</p>}
    </form>
  );
}

export function AgeCategoryDelete({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="gph-icon-btn text-danger" disabled={pending}
      onClick={() => confirm("Supprimer cette catégorie et ses catégories de poids ?") && start(() => deleteAgeCategory(id))} aria-label="Supprimer">
      <Trash2 size={13} />
    </button>
  );
}

type PoomsaeRow = { id: string; label: string; ageMin: number; ageMax: number | null; poomsae: string };

export function AllowedPoomsaeForm({ seasonId, item, onDone }: { seasonId: string; item?: PoomsaeRow; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveAllowedPoomsae, undefined);
  const done = useRef(onDone);
  useEffect(() => { if (state?.ok && done.current) done.current(); }, [state]);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_80px_80px_2fr_auto]">
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="seasonId" value={seasonId} />
      <input name="label" required maxLength={60} defaultValue={item?.label} placeholder="Catégorie" className="gph-input py-2 text-[13px]" />
      <input name="ageMin" type="number" required defaultValue={item?.ageMin} placeholder="âge min" className="gph-input py-2 text-[13px]" />
      <input name="ageMax" type="number" defaultValue={item?.ageMax ?? ""} placeholder="âge max" className="gph-input py-2 text-[13px]" />
      <input name="poomsae" required maxLength={400} defaultValue={item?.poomsae} placeholder="Taegeuk 4, 5, 6…" className="gph-input py-2 text-[13px]" />
      <button className="gph-btn-ghost" disabled={pending}>{item ? "Enregistrer" : "Ajouter"}</button>
      {state?.errors && <p className="text-xs font-semibold text-danger sm:col-span-5">{Object.values(state.errors)[0]}</p>}
    </form>
  );
}

export function AllowedPoomsaeDelete({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="gph-icon-btn text-danger" disabled={pending} onClick={() => start(() => deleteAllowedPoomsae(id))} aria-label="Supprimer">
      <Trash2 size={13} />
    </button>
  );
}
