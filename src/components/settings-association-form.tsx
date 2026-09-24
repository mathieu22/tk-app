"use client";
// US-8.2 : paramètres de l'association.
import { Check } from "lucide-react";
import { useActionState } from "react";
import { saveAssociation } from "@/app/actions/settings";
import { ImageInput } from "@/components/image-input";
import { MONTH_LABELS } from "@/lib/format";
import { Card, Field, FormMessage } from "./settings-ui";

type Values = {
  name: string; logoUrl: string; address: string; phone: string; email: string; receiptFooter: string;
  currentSchoolYear: string; schoolYearStartMon: number; newMemberDays: number; thresholdGreen: number; thresholdOrange: number;
  poomToDanAge: number; weightAlertKg: number; weighInMaxDays: number; expenseApprovalMin: number;
};

export function SettingsAssociationForm({ values: saved }: { values: Values }) {
  const [state, action, pending] = useActionState(saveAssociation, undefined);
  const e = state?.errors ?? {};
  // Après une erreur, on réaffiche la saisie (React réinitialise le formulaire sur ses defaultValue).
  const v = { ...saved, ...(state?.values ?? {}) } as Values;
  const num = (name: keyof Values, label: string, opts: { min?: number; max?: number; step?: number; suffix?: string; hint?: string } = {}) => (
    <Field label={label} error={e[name]} hint={opts.hint} htmlFor={name}>
      <div className="relative">
        <input id={name} name={name} type="number" inputMode="decimal" required defaultValue={v[name] as number}
          min={opts.min} max={opts.max} step={opts.step ?? 1} aria-invalid={!!e[name]}
          className={`gph-input ${opts.suffix ? "pr-14" : ""}`} />
        {opts.suffix && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-3">{opts.suffix}</span>}
      </div>
    </Field>
  );

  return (
    <form action={action} className="grid gap-4 px-4 lg:grid-cols-2 lg:items-start">
      <Card title="Identité">
        <div className="flex flex-col gap-3.5">
          <ImageInput name="logoUrl" defaultValue={saved.logoUrl} square maxSize={256} label="Ajouter un logo" />
          <Field label="Nom" error={e.name} htmlFor="name">
            <input id="name" name="name" required maxLength={120} defaultValue={v.name} className="gph-input" aria-invalid={!!e.name} />
          </Field>
          <Field label="Adresse" optional htmlFor="address">
            <textarea id="address" name="address" rows={2} maxLength={300} defaultValue={v.address} className="gph-input" />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Téléphone" optional error={e.phone} htmlFor="phone">
              <input id="phone" name="phone" type="tel" defaultValue={v.phone} placeholder="+261 34 12 345 67" className="gph-input" aria-invalid={!!e.phone} />
            </Field>
            <Field label="Email" optional error={e.email} htmlFor="email">
              <input id="email" name="email" type="email" defaultValue={v.email} className="gph-input" aria-invalid={!!e.email} />
            </Field>
          </div>
          <Field label="Mentions sur les reçus" optional hint="Ex. n° d'agrément, NIF, cachet…" htmlFor="receiptFooter">
            <textarea id="receiptFooter" name="receiptFooter" rows={2} maxLength={500} defaultValue={v.receiptFooter} className="gph-input" />
          </Field>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card title="Année scolaire">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Année en cours" error={e.currentSchoolYear} htmlFor="currentSchoolYear">
              <input id="currentSchoolYear" name="currentSchoolYear" required pattern="\d{4}-\d{4}" defaultValue={v.currentSchoolYear}
                placeholder="2025-2026" className="gph-input" aria-invalid={!!e.currentSchoolYear} />
            </Field>
            <Field label="Mois de début" error={e.schoolYearStartMon} htmlFor="schoolYearStartMon">
              <select id="schoolYearStartMon" name="schoolYearStartMon" defaultValue={v.schoolYearStartMon} className="gph-input">
                {MONTH_LABELS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </Field>
          </div>
        </Card>

        <Card title="Présence et membres">
          <div className="grid gap-3.5 sm:grid-cols-3">
            {num("thresholdGreen", "Seuil vert", { min: 1, max: 100, suffix: "%" })}
            {num("thresholdOrange", "Seuil orange", { min: 0, max: 99, suffix: "%" })}
            {num("newMemberDays", "« Nouveau »", { min: 1, max: 365, suffix: "jours" })}
          </div>
          <p className="mt-2 text-xs text-ink-3">Vert si taux ≥ seuil vert, orange entre les deux seuils, rouge en dessous.</p>
        </Card>

        <Card title="Taekwondo">
          <div className="grid gap-3.5 sm:grid-cols-3">
            {num("poomToDanAge", "Poom → dan", { min: 10, max: 30, suffix: "ans" })}
            {num("weightAlertKg", "Alerte poids", { min: 0, max: 10, step: 0.1, suffix: "kg", hint: "Proche d'une limite" })}
            {num("weighInMaxDays", "Pesée valable", { min: 1, max: 365, suffix: "jours" })}
          </div>
        </Card>

        <Card title="Trésorerie">
          {num("expenseApprovalMin", "Dépense à valider par le Président à partir de", { min: 0, suffix: "Ar" })}
        </Card>

        <FormMessage state={state} />
        <button className="gph-btn-primary full" disabled={pending}>
          <Check size={18} strokeWidth={2.5} /> Enregistrer
        </button>
      </div>
    </form>
  );
}
