"use client";
import { Check, Search } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { saveEvent } from "@/app/actions/events";
import { FormTopBar } from "@/components/ui";
import { AUDIENCES, EventTypeIcon, MODES } from "./_meta";

type Opt = { id: string; name: string };
export type EventFormInitial = Partial<Record<
  "id" | "title" | "typeId" | "startDate" | "endDate" | "startTime" | "endTime" | "location" | "description" | "audience" |
  "groupIds" | "memberIds" | "participationMode" | "maxSeats" | "registrationUntil" | "fee", string>>;

export function EventForm({ types, groups, members, initial, cancelHref }: {
  types: { id: string; label: string; icon: string; color: string }[];
  groups: Opt[];
  members: (Opt & { group: string | null })[];
  initial: EventFormInitial;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState(saveEvent, undefined);
  const v = { ...initial, ...(state?.values ?? {}) };
  const e = state?.errors ?? {};
  const [typeId, setTypeId] = useState(v.typeId ?? types[0]?.id ?? "");
  const [audience, setAudience] = useState(v.audience ?? "ALL");
  const [mode, setMode] = useState(v.participationMode ?? "OPEN");
  const [groupIds, setGroupIds] = useState<string[]>(v.groupIds ? v.groupIds.split(",").filter(Boolean) : []);
  const [memberIds, setMemberIds] = useState<string[]>(v.memberIds ? v.memberIds.split(",").filter(Boolean) : []);
  const [q, setQ] = useState("");
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return members.filter((m) => !t || m.name.toLowerCase().includes(t) || (m.group ?? "").toLowerCase().includes(t)).slice(0, 60);
  }, [members, q]);
  const parents = audience === "PARENTS";

  return (
    <form action={action}>
      <FormTopBar cancelHref={cancelHref} title={v.id ? "Modifier l'événement" : "Nouvel événement"} />
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <input type="hidden" name="typeId" value={typeId} />
      <input type="hidden" name="audience" value={audience} />
      <input type="hidden" name="participationMode" value={parents ? "OPEN" : mode} />
      <input type="hidden" name="groupIds" value={groupIds.join(",")} />
      <input type="hidden" name="memberIds" value={memberIds.join(",")} />

      <div className="grid gap-3.5 px-4 lg:grid-cols-2 lg:gap-x-6">
        <Field label="Titre" error={e.title} wide>
          <input name="title" required maxLength={120} defaultValue={v.title} placeholder="Stage poomsae" className="gph-input" aria-invalid={!!e.title} />
        </Field>

        <Field label="Type" error={e.typeId} wide>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {types.map((t) => {
              const sel = typeId === t.id;
              return (
                <button type="button" key={t.id} onClick={() => setTypeId(t.id)} aria-pressed={sel}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold"
                  style={{ background: sel ? t.color : "#fff", color: sel ? "#fff" : "var(--gph-ink)", border: sel ? "none" : "1px solid var(--gph-divider)" }}>
                  <EventTypeIcon icon={t.icon} size={16} color={sel ? "#fff" : t.color} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Début" error={e.startDate}>
            <input name="startDate" type="date" required defaultValue={v.startDate} className="gph-input" aria-invalid={!!e.startDate} />
          </Field>
          <Field label="Fin" optional error={e.endDate}>
            <input name="endDate" type="date" defaultValue={v.endDate} className="gph-input" aria-invalid={!!e.endDate} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Heure début" optional error={e.startTime}>
            <input name="startTime" type="time" defaultValue={v.startTime} className="gph-input" />
          </Field>
          <Field label="Heure fin" optional error={e.endTime}>
            <input name="endTime" type="time" defaultValue={v.endTime} className="gph-input" aria-invalid={!!e.endTime} />
          </Field>
        </div>
        <Field label="Lieu" optional>
          <input name="location" maxLength={160} defaultValue={v.location} placeholder="Gymnase d'Ankorondrano" className="gph-input" />
        </Field>
        <Field label="Frais de participation" optional error={e.fee}>
          <div className="relative">
            <input name="fee" type="number" min={0} step={500} inputMode="numeric" defaultValue={v.fee} placeholder="0" className="gph-input gph-amount pr-12" />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-3">Ar</span>
          </div>
        </Field>
        <Field label="Description" optional wide>
          <textarea name="description" rows={3} maxLength={2000} defaultValue={v.description} className="gph-input" />
        </Field>

        <Field label="Public concerné" error={e.groupIds ?? e.memberIds} wide>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(AUDIENCES) as (keyof typeof AUDIENCES)[]).map((a) => (
              <button type="button" key={a} onClick={() => setAudience(a)} aria-pressed={audience === a}
                className={`gph-chip${audience === a ? " active" : ""}`}>
                {audience === a && <Check size={12} strokeWidth={3} />}
                {AUDIENCES[a]}
              </button>
            ))}
          </div>
          {audience === "GROUPS" && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {groups.map((g) => (
                <button type="button" key={g.id} onClick={() => setGroupIds(toggle(groupIds, g.id))} aria-pressed={groupIds.includes(g.id)}
                  className={`gph-chip${groupIds.includes(g.id) ? " active" : ""}`}>
                  {groupIds.includes(g.id) && <Check size={12} strokeWidth={3} />}
                  {g.name}
                </button>
              ))}
            </div>
          )}
          {audience === "SELECTION" && (
            <div className="gph-card mt-2.5 p-2.5">
              <div className="relative mb-2">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Rechercher un athlète" className="gph-input with-icon py-2.5" />
              </div>
              <div className="mb-1 px-1 text-xs font-semibold text-ink-3">{memberIds.length} sélectionné{memberIds.length > 1 ? "s" : ""}</div>
              <div className="flex max-h-64 flex-col overflow-y-auto">
                {shown.map((m) => {
                  const sel = memberIds.includes(m.id);
                  return (
                    <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-bg">
                      <input type="checkbox" checked={sel} onChange={() => setMemberIds(toggle(memberIds, m.id))} className="h-4 w-4 accent-[var(--gph-primary)]" />
                      <span className="flex-1 text-sm font-semibold">{m.name}</span>
                      {m.group && <span className="text-xs text-ink-3">{m.group}</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {parents && <p className="mt-2 text-xs text-ink-3">Réunion des parents : pointage par le QR code du compte parent, sans inscription.</p>}
        </Field>

        {!parents && (
          <Field label="Mode de participation" wide>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(MODES) as (keyof typeof MODES)[]).map((m) => {
                const sel = mode === m;
                return (
                  <button type="button" key={m} onClick={() => setMode(m)} aria-pressed={sel}
                    className="rounded-xl px-3 py-2.5 text-left"
                    style={{ border: sel ? "2px solid var(--gph-primary)" : "1px solid var(--gph-divider)", background: sel ? "var(--gph-primary-soft)" : "#fff" }}>
                    <span className={`block text-[13px] font-bold ${sel ? "text-primary" : ""}`}>{MODES[m].label}</span>
                    <span className="block text-[11px] font-medium text-ink-3">{MODES[m].hint}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {!parents && mode !== "OPEN" && (
          <>
            <Field label="Places maximum" optional error={e.maxSeats}>
              <input name="maxSeats" type="number" min={1} inputMode="numeric" defaultValue={v.maxSeats} placeholder="Illimité" className="gph-input" />
            </Field>
            {mode === "REGISTRATION" ? (
              <Field label="Date limite d'inscription" optional error={e.registrationUntil}>
                <input name="registrationUntil" type="date" defaultValue={v.registrationUntil} className="gph-input" />
              </Field>
            ) : <input type="hidden" name="registrationUntil" value="" />}
          </>
        )}
        {(parents || mode === "OPEN") && (
          <>
            <input type="hidden" name="maxSeats" value="" />
            <input type="hidden" name="registrationUntil" value="" />
          </>
        )}

        <div className="mt-2 lg:col-span-2">
          <button className="gph-btn-primary full lg:w-auto lg:px-10" disabled={pending}>
            <Check size={18} strokeWidth={2.5} />
            {v.id ? "Enregistrer" : "Créer l'événement"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, optional, error, wide, children }: { label: string; optional?: boolean; error?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "lg:col-span-2" : undefined}>
      <div className="gph-label">
        {label} {optional && <span className="opt">(optionnel)</span>}
      </div>
      {children}
      {error && <p className="mt-1.5 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
