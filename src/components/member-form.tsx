"use client";
// Formulaire d'ajout / modification d'un membre (design : ScreenAddMember ; spec US-2.5).
import { Check, ChevronDown, Mail, Phone } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import { saveMember, type MemberFormState } from "@/app/actions/members";
import { ImageInput } from "@/components/image-input";
import { TutorField, type TutorValue } from "@/components/member-tutor-field";
import { FormTopBar } from "@/components/ui";
import { BLOOD_GROUPS, MEMBER_STATUSES, POSITIONS, SEXES } from "@/lib/domain";

export type MemberFormValues = {
  id?: string;
  lastName?: string;
  firstName?: string;
  sex?: string;
  birthDate?: string; // AAAA-MM-JJ
  birthPlace?: string;
  nationality?: string;
  phone?: string;
  email?: string;
  facebook?: string;
  address?: string;
  position?: string;
  status?: string;
  joinedAt?: string;
  groupId?: string;
  bloodGroup?: string;
  medicalInfo?: string;
  photoUrl?: string;
  photoConsent?: boolean;
  licenseNo?: string;
  kukkiwonNo?: string;
  gradeId?: string;
  weightKg?: string;
  tutor1?: TutorValue;
  tutor2?: TutorValue;
};

export type GradeOption = { id: string; label: string; grid: string };

function isMinorDate(iso?: string) {
  if (!iso) return false;
  const b = new Date(`${iso}T00:00:00`);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return a < 18;
}

export function MemberForm({ values: initial, groups, grades, cancelHref }: {
  values: MemberFormValues;
  groups: { id: string; name: string }[];
  grades: GradeOption[];
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState<MemberFormState, FormData>(saveMember, undefined);
  const values: MemberFormValues = { ...initial, ...state?.values, id: initial.id };
  const [position, setPosition] = useState(initial.position ?? "ATHLETE");
  const err = state?.fieldErrors ?? {};
  const [birthDate, setBirthDate] = useState(values.birthDate ?? "");
  const minor = isMinorDate(birthDate);
  const grids = [...new Set(grades.map((g) => g.grid))];

  return (
    <form action={action} noValidate>
      <FormTopBar
        cancelHref={cancelHref}
        title={values.id ? "Modifier le membre" : "Nouveau membre"}
        action={
          <button type="submit" disabled={pending} className="text-[15px] font-bold text-primary disabled:opacity-50">
            {pending ? "…" : "Enregistrer"}
          </button>
        }
      />
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <div className="px-4 pb-6">
        <div className="flex flex-col items-center gap-2 pb-5 pt-2.5">
          <ImageInput name="photoUrl" defaultValue={initial.photoUrl} square round maxSize={384} />
          <label className="flex items-center gap-2 text-xs font-medium text-ink-2">
            <input type="checkbox" name="photoConsent" defaultChecked={initial.photoConsent} className="h-4 w-4 accent-[var(--gph-primary)]" />
            Consentement à l&apos;utilisation de la photo
          </label>
          {err.photoUrl && <p className="text-xs font-semibold text-danger">{err.photoUrl}</p>}
        </div>

        {state?.error && <p role="alert" className="gph-badge danger mb-4 w-full justify-center whitespace-normal py-2.5 text-center text-[13px]">{state.error}</p>}

        <div className="flex flex-col gap-3">
          <Section title="Identité">
            <Field label="Nom(s)" error={err.lastName}>
              <input name="lastName" defaultValue={values.lastName} required autoCapitalize="characters" className="gph-input uppercase" aria-invalid={!!err.lastName} />
            </Field>
            <Field label="Prénom(s)" error={err.firstName}>
              <input name="firstName" defaultValue={values.firstName} required autoCapitalize="words" className="gph-input" aria-invalid={!!err.firstName} />
            </Field>
            <Field label="Sexe" error={err.sex}>
              <div className="flex gap-2">
                {Object.entries(SEXES).map(([v, l]) => (
                  <label key={v} className="gph-chip has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-white">
                    <input type="radio" name="sex" value={v} defaultChecked={values.sex === v} className="sr-only" required />
                    {l}
                  </label>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date de naissance" error={err.birthDate}>
                <input type="date" name="birthDate" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required className="gph-input" aria-invalid={!!err.birthDate} />
              </Field>
              <Field label="Lieu de naissance" optional>
                <input name="birthPlace" defaultValue={values.birthPlace} className="gph-input" />
              </Field>
            </div>
            <Field label="Nationalité">
              <input name="nationality" defaultValue={values.nationality ?? "Malagasy"} className="gph-input" />
            </Field>
          </Section>

          <Section title="Contact">
            <Field label="Téléphone" optional={minor} error={err.phone}>
              <div className="relative">
                <Phone size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                <input name="phone" type="tel" inputMode="tel" defaultValue={values.phone} placeholder="+261 34 12 345 67" className="gph-input with-icon" aria-invalid={!!err.phone} />
              </div>
            </Field>
            <Field label="Email" optional error={err.email}>
              <div className="relative">
                <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                <input name="email" type="email" inputMode="email" defaultValue={values.email} placeholder="mialy@exemple.mg" className="gph-input with-icon" aria-invalid={!!err.email} />
              </div>
            </Field>
            <Field label="Facebook" optional>
              <input name="facebook" defaultValue={values.facebook} placeholder="Nom de profil ou lien" className="gph-input" />
            </Field>
            <Field label="Adresse" optional>
              <textarea name="address" defaultValue={values.address} rows={2} placeholder="Lot II M 45 Antsakaviro, Antananarivo" className="gph-input resize-none" />
            </Field>
          </Section>

          <Section title="Tuteurs" defaultOpen={minor || !!initial.tutor1}>
            <p className="-mt-1 text-xs text-ink-3">
              {minor ? "Tuteur 1 obligatoire pour un mineur : contact principal, destinataire des reçus et notifications." : "Contacts des parents ou tuteurs (facultatif pour un majeur)."}
            </p>
            <TutorField prefix="t1" label="Tuteur 1" initial={initial.tutor1} error={err.t1} required={minor} />
            <TutorField prefix="t2" label="Tuteur 2" initial={initial.tutor2} error={err.t2} />
          </Section>

          <Section title="Club">
            <Field label="Poste dans le club" error={err.position}>
              <input type="hidden" name="position" value={position} />
              <div className="flex flex-wrap gap-2">
                {Object.entries(POSITIONS).map(([v, l]) => (
                  <button type="button" key={v} onClick={() => setPosition(v)} aria-pressed={position === v} className={`gph-chip${position === v ? " active" : ""}`}>
                    {position === v && <Check size={12} strokeWidth={3} />}
                    {l}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Statut">
                <select name="status" defaultValue={values.status ?? "ACTIVE"} className="gph-input">
                  {Object.entries(MEMBER_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Date d'inscription" error={err.joinedAt}>
                <input type="date" name="joinedAt" defaultValue={values.joinedAt} required className="gph-input" />
              </Field>
            </div>
            <Field label="Groupe d'entraînement" optional>
              <select name="groupId" defaultValue={values.groupId ?? ""} className="gph-input">
                <option value="">—</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
          </Section>

          <Section title="Santé" defaultOpen={false}>
            <Field label="Groupe sanguin" optional error={err.bloodGroup}>
              <select name="bloodGroup" defaultValue={values.bloodGroup ?? ""} className="gph-input">
                <option value="">—</option>
                {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Allergies / informations médicales" optional>
              <textarea name="medicalInfo" defaultValue={values.medicalInfo} rows={2} className="gph-input resize-none" />
            </Field>
          </Section>
          <Section title="Taekwondo" defaultOpen={false}>
            <Field label="Grade actuel" optional error={err.gradeId}>
              <select name="gradeId" defaultValue={initial.gradeId ?? ""} className="gph-input">
                <option value="">—</option>
                {grids.map((grid) => (
                  <optgroup key={grid} label={`Grille ${grid}`}>
                    {grades.filter((g) => g.grid === grid).map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
            {!initial.gradeId && (
              <Field label="Obtenu le" optional>
                <input type="date" name="gradeDate" className="gph-input" />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="N° licence fédérale" optional>
                <input name="licenseNo" defaultValue={values.licenseNo} className="gph-input" />
              </Field>
              <Field label="N° Kukkiwon" optional>
                <input name="kukkiwonNo" defaultValue={values.kukkiwonNo} className="gph-input" />
              </Field>
            </div>
            <Field label="Poids (kg)" optional error={err.weightKg}>
              <input name="weightKg" inputMode="decimal" defaultValue={values.weightKg} placeholder="43,5" className="gph-input" aria-invalid={!!err.weightKg} />
            </Field>
          </Section>
        </div>

        <button type="submit" disabled={pending} className="gph-btn-primary full mt-5">
          <Check size={18} strokeWidth={2.5} />
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group gph-card">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-bold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown size={18} className="text-ink-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3.5 px-4 pb-4">{children}</div>
    </details>
  );
}

function Field({ label, optional, error, children }: { label: string; optional?: boolean; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="gph-label">
        {label} {optional && <span className="opt">(optionnel)</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
