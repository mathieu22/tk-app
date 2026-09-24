"use client";
// US-8.3 : création d'un compte ; profil proposé selon le poste du membre lié.
import { Check } from "lucide-react";
import { useActionState, useState } from "react";
import { createUser } from "@/app/actions/settings";
import { formatPhone } from "@/lib/format";
import { PROFILE_FOR_POSITION, PROFILE_LABELS } from "./settings-defaults";
import { Card, Field, FormMessage } from "./settings-ui";

type M = { id: string; name: string; matricule: string; position: string; phone: string; email: string };
const PROFILES = ["ADMIN", "PRESIDENT", "SECRETARY", "TREASURER", "COACH", "ATHLETE", "PARENT"];

export function SettingsUserForm({ members }: { members: M[] }) {
  const [state, action, pending] = useActionState(createUser, undefined);
  const v = state?.values ?? {};
  const e = state?.errors ?? {};
  const [memberId, setMemberId] = useState(v.memberId ?? "");
  const [profile, setProfile] = useState(v.profile ?? "COACH");
  const [phone, setPhone] = useState(v.phone ?? "");
  const [email, setEmail] = useState(v.email ?? "");

  const pickMember = (id: string) => {
    setMemberId(id);
    const m = members.find((x) => x.id === id);
    if (!m) return;
    setProfile(PROFILE_FOR_POSITION[m.position] ?? "ATHLETE");
    if (m.phone) setPhone(formatPhone(m.phone));
    if (m.email) setEmail(m.email);
  };

  return (
    <form action={action} className="mx-auto flex max-w-xl flex-col gap-4 px-4">
      <Card>
        <div className="flex flex-col gap-3.5">
          <Field label="Membre lié" optional error={e.memberId} hint="Propose le profil selon le poste (Président, Trésorier, Entraîneur…)." htmlFor="memberId">
            <select id="memberId" name="memberId" value={memberId} onChange={(ev) => pickMember(ev.target.value)} className="gph-input">
              <option value="">— Aucun —</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.matricule}</option>)}
            </select>
          </Field>
          <Field label="Téléphone (identifiant)" error={e.phone} htmlFor="phone">
            <input id="phone" name="phone" type="tel" required value={phone} onChange={(ev) => setPhone(ev.target.value)}
              placeholder="+261 34 12 345 67" className="gph-input" aria-invalid={!!e.phone} />
          </Field>
          <Field label="Email" optional error={e.email} htmlFor="email">
            <input id="email" name="email" type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} className="gph-input" aria-invalid={!!e.email} />
          </Field>
          <Field label="Profil d'accès" error={e.profile}>
            <input type="hidden" name="profile" value={profile} />
            <div className="flex flex-wrap gap-2">
              {PROFILES.map((p) => (
                <button type="button" key={p} onClick={() => setProfile(p)} aria-pressed={profile === p}
                  className={`gph-chip${profile === p ? " active" : ""}`}>
                  {profile === p && <Check size={12} strokeWidth={3} />}
                  {PROFILE_LABELS[p]}
                </button>
              ))}
            </div>
          </Field>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="checkbox" name="invite" defaultChecked className="h-5 w-5 accent-[var(--gph-primary)]" />
            Envoyer l&apos;invitation par SMS (lien d&apos;activation valable 7 jours)
          </label>
        </div>
      </Card>
      <FormMessage state={state} />
      <button className="gph-btn-primary full" disabled={pending}>
        <Check size={18} strokeWidth={2.5} /> Créer le compte
      </button>
    </form>
  );
}
