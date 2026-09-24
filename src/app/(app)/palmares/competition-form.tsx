"use client";
import { Check } from "lucide-react";
import { useActionState } from "react";
import { saveCompetition } from "@/app/actions/palmares";
import { ImageInput } from "@/components/image-input";
import { FormTopBar } from "@/components/ui";
import { KINDS, LEVELS } from "./labels";

type Competition = {
  id: string; name: string; startDate: string; endDate: string; location: string | null; level: string; kind: string;
  organizer: string | null; posterUrl: string | null; seasonId: string | null;
};

export function CompetitionForm({ seasons, today, competition }: {
  seasons: { id: string; year: number }[]; today: string; competition?: Competition;
}) {
  const [state, action, pending] = useActionState(saveCompetition, undefined);
  const e = state?.errors ?? {};
  const cancelHref = competition ? `/palmares/competitions/${competition.id}` : "/palmares";

  return (
    <form action={action}>
      <FormTopBar cancelHref={cancelHref} title={competition ? "Modifier" : "Nouvelle compétition"} />
      {competition && <input type="hidden" name="id" value={competition.id} />}
      <div className="flex flex-col gap-4 px-4 lg:mx-auto lg:max-w-2xl">
        <div>
          <label className="gph-label" htmlFor="name">Nom</label>
          <input id="name" name="name" required maxLength={160} defaultValue={competition?.name} className="gph-input" aria-invalid={!!e.name} />
          {e.name && <p className="mt-1.5 text-xs font-semibold text-danger">{e.name}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="gph-label" htmlFor="startDate">Date de début</label>
            <input id="startDate" name="startDate" type="date" required defaultValue={competition?.startDate ?? today} className="gph-input" />
          </div>
          <div>
            <label className="gph-label" htmlFor="endDate">Date de fin</label>
            <input id="endDate" name="endDate" type="date" required defaultValue={competition?.endDate ?? today} className="gph-input" aria-invalid={!!e.endDate} />
            {e.endDate && <p className="mt-1.5 text-xs font-semibold text-danger">{e.endDate}</p>}
          </div>
        </div>
        <div>
          <label className="gph-label" htmlFor="location">Lieu <span className="opt">(optionnel)</span></label>
          <input id="location" name="location" maxLength={160} defaultValue={competition?.location ?? ""} className="gph-input" />
        </div>
        <div>
          <label className="gph-label">Niveau</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(LEVELS).map(([v, l]) => (
              <label key={v} className="gph-chip has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-white">
                <input type="radio" name="level" value={v} defaultChecked={(competition?.level ?? "LOCAL") === v} className="sr-only" /> {l}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="gph-label">Type</label>
          <div className="flex gap-2">
            {Object.entries(KINDS).map(([v, l]) => (
              <label key={v} className="gph-chip has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-white">
                <input type="radio" name="kind" value={v} defaultChecked={(competition?.kind ?? "INDIVIDUAL") === v} className="sr-only" /> {l}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="gph-label" htmlFor="organizer">Organisateur <span className="opt">(optionnel)</span></label>
          <input id="organizer" name="organizer" maxLength={160} defaultValue={competition?.organizer ?? ""} className="gph-input" />
        </div>
        <div>
          <label className="gph-label" htmlFor="seasonId">Saison de référence <span className="opt">(catégories d&apos;âge / poids)</span></label>
          <select id="seasonId" name="seasonId" defaultValue={competition?.seasonId ?? ""} className="gph-input">
            <option value="">Automatique (année de la compétition)</option>
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.year}</option>)}
          </select>
        </div>
        <div>
          <label className="gph-label">Affiche <span className="opt">(optionnel)</span></label>
          <ImageInput name="posterUrl" defaultValue={competition?.posterUrl} maxSize={1400} label="Ajouter une affiche" />
        </div>
        {state?.error && <p role="alert" className="gph-badge danger justify-center py-2.5 text-[13px]">{state.error}</p>}
        <button className="gph-btn-primary full mb-4" disabled={pending}>
          <Check size={18} strokeWidth={2.5} /> {competition ? "Enregistrer" : "Créer la compétition"}
        </button>
      </div>
    </form>
  );
}
