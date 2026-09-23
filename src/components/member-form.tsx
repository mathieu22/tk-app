"use client";
// Formulaire d'ajout / modification d'un membre (design : ScreenAddMember ; spec US-2.5).
import { Camera, Check, ChevronDown, Mail, Phone, User } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import { saveMember, type MemberFormState } from "@/app/actions/members";
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
};

export function MemberForm({ values: initial, groups, cancelHref }: {
  values: MemberFormValues;
  groups: { id: string; name: string }[];
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState<MemberFormState, FormData>(saveMember, undefined);
  const values: MemberFormValues = { ...initial, ...state?.values, id: initial.id };
  const [position, setPosition] = useState(initial.position ?? "ATHLETE");
  const err = state?.fieldErrors ?? {};

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
        {/* Photo (upload à venir) */}
        <div className="flex flex-col items-center pb-5 pt-2.5">
          <div className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full border-2 border-dashed border-primary bg-primary-soft">
            <User size={36} strokeWidth={1.6} className="text-primary" />
            <div className="absolute -bottom-1 -right-1 flex h-[30px] w-[30px] items-center justify-center rounded-full border-[3px] border-bg bg-primary">
              <Camera size={14} color="#fff" />
            </div>
          </div>
          <div className="mt-2.5 text-xs font-semibold text-ink-3">Photo : bientôt disponible</div>
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
                <input type="date" name="birthDate" defaultValue={values.birthDate} required className="gph-input" aria-invalid={!!err.birthDate} />
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
            <Field label="Téléphone" error={err.phone}>
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
          {/* TODO Tuteurs (TUTEUR1 / TUTEUR2) et Taekwondo (grade, licence, pesée) — phase 2. */}
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
