"use client";
// US-8.3 : profil, activation, invitation et réinitialisation du mot de passe.
import { KeyRound, Power, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { changeProfile, sendUserLink, setUserActive, type FormState } from "@/app/actions/settings";
import { PROFILE_LABELS } from "./settings-defaults";
import { Card, FormMessage } from "./settings-ui";

const PROFILES = ["ADMIN", "PRESIDENT", "SECRETARY", "TREASURER", "COACH", "ATHLETE", "PARENT"];

export function SettingsUserActions({ userId, profile, active, self }: { userId: string; profile: string; active: boolean; self: boolean }) {
  const [msg, setMsg] = useState<FormState>(undefined);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<FormState>) => start(async () => setMsg(await fn()));
  return (
    <Card title="Accès">
      <div className="flex flex-col gap-3.5">
        <div>
          <label className="gph-label" htmlFor="profile">Profil</label>
          <select id="profile" defaultValue={profile} disabled={pending} className="gph-input"
            onChange={(e) => {
              const p = e.target.value;
              if (!confirm(`Passer ce compte en profil « ${PROFILE_LABELS[p]} » ?`)) {
                e.target.value = profile;
                return;
              }
              run(() => changeProfile(userId, p));
            }}>
            {PROFILES.map((p) => <option key={p} value={p}>{PROFILE_LABELS[p]}</option>)}
          </select>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="gph-btn-ghost" disabled={pending || !active} onClick={() => run(() => sendUserLink(userId, "INVITE"))}>
            <Send size={15} /> Renvoyer l&apos;invitation
          </button>
          <button className="gph-btn-ghost" disabled={pending || !active} onClick={() => run(() => sendUserLink(userId, "RESET"))}>
            <KeyRound size={15} /> Réinitialiser le mot de passe
          </button>
        </div>
        {!self && (
          <button className={`gph-btn-ghost ${active ? "text-danger" : "text-primary"}`} disabled={pending}
            onClick={() => {
              if (active && !confirm("Désactiver ce compte ? L'utilisateur ne pourra plus se connecter.")) return;
              run(() => setUserActive(userId, !active));
            }}>
            <Power size={15} /> {active ? "Désactiver le compte" : "Réactiver le compte"}
          </button>
        )}
        <FormMessage state={msg} />
      </div>
    </Card>
  );
}
