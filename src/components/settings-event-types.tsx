"use client";
// Types d'événements (liste modifiable, spec EPIC 1 « Gestion des événements »).
import {
  Award, Bus, CalendarDays, Check, Dumbbell, Flag, Heart, Medal, Megaphone, PartyPopper, Pencil, Plus, Sparkles, Trash2, Trophy, Users, X,
  type LucideIcon,
} from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { deleteEventType, saveEventType, type FormState } from "@/app/actions/settings";
import { EVENT_ICONS } from "./settings-defaults";
import { FormMessage } from "./settings-ui";

const ICONS: Record<string, LucideIcon> = {
  dumbbell: Dumbbell, award: Award, trophy: Trophy, sparkles: Sparkles, users: Users, "party-popper": PartyPopper,
  "calendar-days": CalendarDays, flag: Flag, medal: Medal, megaphone: Megaphone, bus: Bus, heart: Heart,
};
type EventType = { id: string; label: string; icon: string; color: string; events: number };

function TypeForm({ type, onDone }: { type?: EventType; onDone?: () => void }) {
  const [icon, setIcon] = useState(type?.icon ?? "calendar-days");
  const [color, setColor] = useState(type?.color ?? "#1b5e20");
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await saveEventType(prev, fd);
    if (r?.ok) onDone?.();
    return r;
  }, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={type?.id ?? ""} />
      <input type="hidden" name="icon" value={icon} />
      <div className="flex gap-2">
        <input type="color" name="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Couleur"
          className="h-[50px] w-[50px] flex-none cursor-pointer rounded-xl border border-divider bg-card p-1" />
        <input name="label" required maxLength={60} defaultValue={type?.label} placeholder="Libellé (ex. Stage)" aria-label="Libellé" className="gph-input flex-1" />
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icône">
        {EVENT_ICONS.map((name) => {
          const I = ICONS[name];
          const sel = name === icon;
          return (
            <button key={name} type="button" role="radio" aria-checked={sel} aria-label={name} onClick={() => setIcon(name)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border"
              style={sel ? { background: color, color: "#fff", borderColor: color } : { borderColor: "var(--gph-divider)", color: "var(--gph-ink-2)" }}>
              <I size={18} />
            </button>
          );
        })}
      </div>
      <FormMessage state={state?.error ? state : undefined} />
      <div className="flex gap-2">
        {onDone && type && <button type="button" onClick={onDone} className="gph-btn-ghost"><X size={16} /> Annuler</button>}
        <button className="gph-btn-primary flex-1" disabled={pending}>
          {type ? <><Check size={16} /> Enregistrer</> : <><Plus size={16} /> Ajouter le type</>}
        </button>
      </div>
    </form>
  );
}

export function SettingsEventTypes({ types }: { types: EventType[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<FormState>(undefined);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-3 px-4 lg:grid-cols-2 lg:items-start">
      <div className="gph-card p-3.5 lg:row-span-6"><TypeForm /></div>
      <FormMessage state={msg} />
      {types.map((t) => {
        const I = ICONS[t.icon] ?? CalendarDays;
        return (
          <div key={t.id} className="gph-card p-3.5">
            {editing === t.id ? (
              <TypeForm type={t} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-white" style={{ background: t.color }}>
                  <I size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold">{t.label}</div>
                  <div className="text-xs font-medium text-ink-3">{t.events} événement{t.events > 1 ? "s" : ""}</div>
                </div>
                <button onClick={() => setEditing(t.id)} className="gph-icon-btn" aria-label={`Modifier ${t.label}`}><Pencil size={15} /></button>
                <button disabled={pending} className="gph-icon-btn text-danger" aria-label={`Supprimer ${t.label}`}
                  onClick={() => {
                    if (!confirm(`Supprimer le type « ${t.label} » ?`)) return;
                    start(async () => setMsg(await deleteEventType(t.id)));
                  }}>
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
