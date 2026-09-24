"use client";
// US-8.1 : édition des couleurs avec aperçu en direct et vérification du contraste WCAG.
import { AlertTriangle, Check, Clock, CreditCard, FileText, GraduationCap, Plus, RotateCcw, X } from "lucide-react";
import { useActionState, useState, useTransition, type CSSProperties } from "react";
import { resetColors, saveColors } from "@/app/actions/settings";
import { DEFAULT_COLORS, contrast } from "./settings-defaults";
import { Card, FormMessage } from "./settings-ui";

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Application", keys: ["--gph-primary", "--gph-primary-deep", "--gph-primary-soft", "--gph-accent"] },
  { title: "Types de frais", keys: ["--gph-droit", "--gph-droit-soft", "--gph-passport", "--gph-passport-soft", "--gph-ecolage", "--gph-ecolage-soft"] },
  { title: "Statuts et seuils de présence", keys: ["--gph-success", "--gph-warning", "--gph-danger"] },
];

const INK = "#1a1a2e";

/** Couples à vérifier : [premier plan, arrière-plan, description]. */
function checks(c: Record<string, string>): [string, string, string][] {
  return [
    ["#ffffff", c["--gph-primary"], "Texte blanc sur la couleur principale (boutons)"],
    [c["--gph-primary"], c["--gph-primary-soft"], "Couleur principale sur son fond clair (onglet actif)"],
    [c["--gph-primary"], "#f5f7fa", "Couleur principale sur le fond de page (liens)"],
    [c["--gph-droit"], c["--gph-droit-soft"], "Droit sur son fond"],
    [c["--gph-passport"], c["--gph-passport-soft"], "Passport sur son fond"],
    [c["--gph-ecolage"], c["--gph-ecolage-soft"], "Écolage sur son fond"],
    ["#ffffff", c["--gph-ecolage"], "Texte blanc sur Écolage (mois sélectionné)"],
    [INK, c["--gph-primary-soft"], "Texte sur le fond clair principal"],
  ];
}

export function SettingsColors({ labels, initial, darkMode }: {
  labels: Record<string, string>; initial: Record<string, string>; darkMode: boolean;
}) {
  const [colors, setColors] = useState(initial);
  const [dark, setDark] = useState(darkMode);
  const [state, action, pending] = useActionState(saveColors, undefined);
  const [resetting, startReset] = useTransition();
  const set = (k: string, v: string) => setColors((c) => ({ ...c, [k]: v }));
  const valid = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
  const previewVars = Object.fromEntries(Object.entries(colors).filter(([, v]) => valid(v))) as CSSProperties;
  const results = checks(Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, valid(v) ? v : DEFAULT_COLORS[k]])));
  const failing = results.filter(([fg, bg]) => contrast(fg, bg) < 4.5).length;

  return (
    <form action={action} className="grid gap-4 px-4 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="flex flex-col gap-4">
        {GROUPS.map((g) => (
          <Card key={g.title} title={g.title}>
            <div className="grid gap-3 sm:grid-cols-2">
              {g.keys.map((k) => (
                <div key={k} className="flex items-center gap-3">
                  <input type="color" aria-label={labels[k]} value={valid(colors[k]) ? colors[k] : DEFAULT_COLORS[k]}
                    onChange={(e) => set(k, e.target.value)}
                    className="h-11 w-11 flex-none cursor-pointer rounded-xl border border-divider bg-card p-1" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{labels[k]}</div>
                    <input name={k} value={colors[k]} onChange={(e) => set(k, e.target.value.trim())} spellCheck={false}
                      aria-invalid={!valid(colors[k])} maxLength={7}
                      className="gph-input gph-amount mt-1 px-2.5 py-1.5 text-[13px]" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}

        <Card title="Mode sombre">
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" name="darkMode" checked={dark} onChange={(e) => setDark(e.target.checked)} className="h-5 w-5 accent-[var(--gph-primary)]" />
            <span className="text-sm font-medium">Activer le thème sombre pour tous les utilisateurs</span>
          </label>
        </Card>
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-4">
        <Card title="Aperçu en direct">
          <div style={previewVars} className="flex flex-col gap-3 rounded-xl bg-[#f5f7fa] p-3">
            <div className="gph-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-ink-3">19/09/2026 · 17h30</div>
                  <div className="text-[15px] font-bold">Entraînement technique</div>
                </div>
                <span className="gph-badge success">82%</span>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef1f6]">
                  <div className="h-full w-[82%] rounded-full" style={{ background: "var(--gph-success)" }} />
                </div>
                <span className="text-xs font-bold text-ink-2">18/22</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="gph-badge success"><Check size={11} strokeWidth={3} />Payé</span>
              <span className="gph-badge warning"><Clock size={11} strokeWidth={3} />Partiel</span>
              <span className="gph-badge danger"><X size={11} strokeWidth={3} />Non payé</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Droit", Icon: FileText, c: "--gph-droit" },
                { label: "Passport", Icon: CreditCard, c: "--gph-passport" },
                { label: "Écolage", Icon: GraduationCap, c: "--gph-ecolage" },
              ].map(({ label, Icon, c }) => (
                <div key={label} className="gph-card flex flex-col items-center gap-1.5 p-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `var(${c}-soft)`, color: `var(${c})` }}>
                    <Icon size={17} />
                  </span>
                  <span className="text-[11px] font-bold">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="gph-btn-primary flex-1"><Plus size={16} strokeWidth={2.5} />Nouvelle session</span>
              <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--gph-primary-soft)", color: "var(--gph-primary)" }}>Actif</span>
            </div>
          </div>
        </Card>

        <Card title="Contraste">
          <ul className="flex flex-col gap-2">
            {results.map(([fg, bg, label]) => {
              const r = contrast(fg, bg);
              const ok = r >= 4.5;
              return (
                <li key={label} className="flex items-center gap-2.5 text-[13px]">
                  <span className="flex h-7 w-10 flex-none items-center justify-center rounded-md border border-divider text-xs font-bold" style={{ background: bg, color: fg }}>Aa</span>
                  <span className="min-w-0 flex-1 text-ink-2">{label}</span>
                  <span className={`gph-badge ${ok ? "success" : "warning"}`}>
                    {!ok && <AlertTriangle size={11} />}
                    {r.toFixed(1)}:1
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-3">
            Seuil recommandé : 4,5:1 (WCAG AA).{" "}
            {failing > 0 ? `${failing} combinaison(s) à améliorer pour la lisibilité.` : "Toutes les combinaisons sont lisibles."}
          </p>
        </Card>

        <FormMessage state={state} />
        <div className="flex gap-2">
          <button type="button" className="gph-btn-ghost flex-1" disabled={resetting}
            onClick={() => {
              if (!confirm("Rétablir toutes les couleurs par défaut ?")) return;
              setColors({ ...DEFAULT_COLORS });
              startReset(() => resetColors());
            }}>
            <RotateCcw size={15} /> Par défaut
          </button>
          <button className="gph-btn-primary flex-1" disabled={pending || Object.values(colors).some((v) => !valid(v))}>
            <Check size={16} strokeWidth={2.5} /> Enregistrer
          </button>
        </div>
      </div>
    </form>
  );
}
