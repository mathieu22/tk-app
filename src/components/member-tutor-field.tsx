"use client";
// Saisie d'un tuteur (TUTEUR1 / TUTEUR2, US-2.5) : recherche d'un parent existant avant création.
import { Phone, Search, Send, UserRound, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { findParents, inviteParent } from "@/app/actions/members";
import { formatPhone } from "@/lib/format";

export type TutorValue = {
  parentId?: string;
  lastName?: string;
  firstName?: string;
  phone?: string;
  email?: string;
  relationship?: string;
  invited?: boolean; // compte déjà activé
};

const RELATIONSHIPS = { FATHER: "Père", MOTHER: "Mère", LEGAL_GUARDIAN: "Tuteur légal", OTHER: "Autre" };

export function TutorField({ prefix, label, initial, error, required }: {
  prefix: "t1" | "t2"; label: string; initial?: TutorValue; error?: string; required?: boolean;
}) {
  const [value, setValue] = useState<TutorValue>(initial ?? {});
  const [mode, setMode] = useState<"search" | "new" | "linked">(initial?.parentId ? "linked" : initial?.lastName ? "new" : "search");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof findParents>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (mode !== "search" || q.trim().length < 2) return;
    const t = setTimeout(() => { void findParents(q).then(setResults); }, 250);
    return () => clearTimeout(t);
  }, [q, mode]);

  const set = (patch: Partial<TutorValue>) => setValue((v) => ({ ...v, ...patch }));
  const clear = () => { setValue({ relationship: value.relationship }); setMode("search"); setQ(""); setResults([]); setMessage(null); };

  return (
    <div>
      <label className="gph-label">
        {label} {!required && <span className="opt">(optionnel)</span>}
      </label>
      {/* Champs envoyés au serveur */}
      <input type="hidden" name={`${prefix}_parentId`} value={mode === "linked" ? value.parentId ?? "" : ""} />
      {mode === "new" && (
        <>
          <input type="hidden" name={`${prefix}_lastName`} value={value.lastName ?? ""} />
          <input type="hidden" name={`${prefix}_firstName`} value={value.firstName ?? ""} />
          <input type="hidden" name={`${prefix}_phone`} value={value.phone ?? ""} />
          <input type="hidden" name={`${prefix}_email`} value={value.email ?? ""} />
        </>
      )}
      <input type="hidden" name={`${prefix}_relationship`} value={value.relationship ?? "OTHER"} />

      <div className="rounded-xl border border-divider bg-card p-3" style={error ? { borderColor: "var(--gph-danger)" } : undefined}>
        {mode === "linked" && (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-primary-soft text-primary"><UserRound size={16} /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{value.firstName} {value.lastName}</div>
              <div className="text-xs font-medium text-ink-3">{value.phone ? formatPhone(value.phone) : "—"}</div>
            </div>
            <button type="button" onClick={clear} className="gph-icon-btn" aria-label="Retirer le tuteur"><X size={16} /></button>
          </div>
        )}

        {mode === "search" && (
          <>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un parent (nom ou téléphone)"
                className="gph-input with-icon" aria-label={`Rechercher ${label}`} />
            </div>
            {q.trim().length >= 2 && (
              <div className="mt-2 flex flex-col">
                {results.map((p) => (
                  <button type="button" key={p.id} className="flex items-center justify-between rounded-lg px-2 py-2.5 text-left hover:bg-bg"
                    onClick={() => { setValue({ ...p, parentId: p.id, email: p.email ?? "", relationship: value.relationship }); setMode("linked"); }}>
                    <span className="text-sm font-semibold">{p.firstName} {p.lastName}</span>
                    <span className="text-xs text-ink-3">{formatPhone(p.phone)}</span>
                  </button>
                ))}
                {results.length === 0 && <p className="px-2 py-2 text-xs text-ink-3">Aucun parent trouvé.</p>}
              </div>
            )}
            <button type="button" onClick={() => setMode("new")} className="mt-2 text-xs font-semibold text-primary">
              + Nouveau tuteur
            </button>
          </>
        )}

        {mode === "new" && (
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <input value={value.lastName ?? ""} onChange={(e) => set({ lastName: e.target.value })} placeholder="Nom" className="gph-input uppercase" aria-label="Nom du tuteur" />
              <input value={value.firstName ?? ""} onChange={(e) => set({ firstName: e.target.value })} placeholder="Prénom" className="gph-input" aria-label="Prénom du tuteur" />
            </div>
            <div className="relative">
              <Phone size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input value={value.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} type="tel" inputMode="tel" placeholder="+261 34 12 345 67" className="gph-input with-icon" aria-label="Téléphone du tuteur" />
            </div>
            <input value={value.email ?? ""} onChange={(e) => set({ email: e.target.value })} type="email" placeholder="Email (optionnel)" className="gph-input" aria-label="Email du tuteur" />
            <button type="button" onClick={clear} className="self-start text-xs font-semibold text-ink-3">Rechercher un parent existant</button>
          </div>
        )}

        {mode !== "search" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {Object.entries(RELATIONSHIPS).map(([v, l]) => (
              <button type="button" key={v} onClick={() => set({ relationship: v })} aria-pressed={value.relationship === v}
                className={`gph-chip${value.relationship === v ? " active" : ""}`} style={{ padding: "6px 11px", fontSize: 12 }}>
                {l}
              </button>
            ))}
            {mode === "linked" && value.parentId && !value.invited && (
              <button type="button" disabled={pending} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-primary"
                onClick={() => start(async () => setMessage((await inviteParent(value.parentId!)).message))}>
                <Send size={13} /> {pending ? "Envoi…" : "Inviter"}
              </button>
            )}
          </div>
        )}
        {message && <p className="mt-2 text-xs font-semibold text-ink-2" role="status">{message}</p>}
      </div>
      {error && <p className="mt-1 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
