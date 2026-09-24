"use client";
// Assistant d'import du fichier des athlètes (US-2.6) : dépôt du fichier, correspondance des
// colonnes si nécessaire, aperçu avec erreurs signalées ligne par ligne, puis import et compte rendu.
import {
  AlertTriangle, Check, ChevronLeft, FileSpreadsheet, Loader2, Upload, UserX, X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { BLOOD_GROUPS, MEMBER_STATUSES, POSITIONS, SEXES } from "@/lib/domain";
import { normalizePhone } from "@/lib/format";
import type { ColumnKey, ImportRow } from "@/lib/import-members";

type ParseResponse =
  | { step: "mapping"; headers: string[]; columnMap: Partial<Record<ColumnKey, string>>; missingRequired: ColumnKey[]; expected: readonly ColumnKey[]; rowCount: number }
  | { step: "preview"; headers: string[]; columnMap: Partial<Record<ColumnKey, string>>; rows: ImportRow[]; summary: { total: number; imported: number; duplicates: number; toFix: number } }
  | { error: string };

type CommitReport = { imported: number; skipped: { rowNumber: number; name: string; reasons: string[] }[]; tutorsLinked: number; tutorsSkipped: number };

const COLUMN_LABELS: Record<ColumnKey, string> = {
  Id: "Matricule (Id)", Noms: "Nom(s)", "Prénoms": "Prénom(s)", Sexe: "Sexe", Date_Naissance: "Date de naissance",
  Lieu_Naissance: "Lieu de naissance", Nationalite: "Nationalité", Groupe_Sangin: "Groupe sanguin", Adresse: "Adresse",
  Contact: "Téléphone", TUTEUR1: "Tuteur 1", TUTEUR2: "Tuteur 2", Mail: "Email", FB: "Facebook",
  Date_inscription: "Date d'inscription", Statut: "Statut", Poste: "Poste",
};

const input = "w-full min-w-0 rounded-md border border-divider px-1.5 py-1 text-xs";

export function ImportWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Partial<Record<ColumnKey, string>>>({});
  const [missingRequired, setMissingRequired] = useState<ColumnKey[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [summary, setSummary] = useState<{ total: number; imported: number; duplicates: number; toFix: number } | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"tous" | "problemes">("tous");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CommitReport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const step = report ? "result" : summary ? "preview" : missingRequired.length ? "mapping" : "upload";

  async function parse(f: File, override?: Partial<Record<ColumnKey, string>>) {
    setPending(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", f);
      if (override) body.set("columnMap", JSON.stringify(override));
      const res = await fetch("/api/membres/import", { method: "POST", body });
      const data: ParseResponse = await res.json();
      if (!res.ok || "error" in data) { setError("error" in data ? data.error : "Erreur inattendue."); return; }
      setHeaders(data.headers);
      setColumnMap(data.columnMap);
      if (data.step === "mapping") setMissingRequired(data.missingRequired);
      else { setMissingRequired([]); setRows(data.rows); setSummary(data.summary); setExcluded(new Set()); }
    } catch {
      setError("Impossible de lire le fichier. Réessayez.");
    } finally {
      setPending(false);
    }
  }

  async function commit() {
    setPending(true);
    setError(null);
    try {
      const payload = rows.filter((r) => !excluded.has(r.rowNumber));
      const res = await fetch("/api/membres/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: payload }) });
      const data: CommitReport | { error: string } = await res.json();
      if (!res.ok || "error" in data) { setError("error" in data ? data.error : "Erreur inattendue."); return; }
      setReport(data);
    } catch {
      setError("Import interrompu. Réessayez.");
    } finally {
      setPending(false);
    }
  }

  function updateRow(rowNumber: number, patch: Partial<ImportRow>) {
    setRows((rs) => rs.map((r) => (r.rowNumber === rowNumber ? { ...r, ...patch } : r)));
  }

  const visibleRows = useMemo(() => (filter === "problemes" ? rows.filter((r) => !r.importable) : rows), [rows, filter]);
  const localImportable = (r: ImportRow) =>
    r.lastName.trim() && r.firstName.trim() && r.sex && r.birthDate && r.status in MEMBER_STATUSES && r.position in POSITIONS &&
    (!r.phone || normalizePhone(r.phone)) && (!r.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));

  return (
    <>
      <div className="flex items-center gap-3 px-4 pb-2 pt-1.5">
        <Link href="/membres" className="gph-icon-btn" aria-label="Retour"><ChevronLeft size={18} /></Link>
        <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em]">Importer les membres</h1>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-8">
        {error && <p role="alert" className="gph-badge danger w-full justify-center whitespace-normal py-2.5 text-center text-[13px]">{error}</p>}

        {step === "upload" && (
          <div className="gph-card flex flex-col items-center gap-3 p-8 text-center">
            <FileSpreadsheet size={40} className="text-primary" strokeWidth={1.5} />
            <div>
              <div className="text-sm font-bold">Fichier Excel ou CSV</div>
              <div className="mt-1 text-xs text-ink-3">
                Colonnes reconnues automatiquement : Id, Noms, Prénoms, Sexe, Date_Naissance, Lieu_Naissance, Nationalite,
                Groupe_Sangin, Adresse, Contact, TUTEUR1, TUTEUR2, Mail, FB, Date_inscription, Statut, Poste.
              </div>
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); void parse(f); } }} />
            <button type="button" disabled={pending} onClick={() => inputRef.current?.click()} className="gph-btn-primary">
              {pending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Choisir un fichier
            </button>
          </div>
        )}

        {step === "mapping" && file && (
          <div className="gph-card p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-warning"><AlertTriangle size={16} /> Correspondance des colonnes</div>
            <p className="mb-3 text-xs text-ink-3">
              Certaines colonnes obligatoires n&apos;ont pas été reconnues automatiquement. Associez chaque champ à une colonne du fichier.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
                <label key={key} className="text-xs font-semibold">
                  {COLUMN_LABELS[key]}{missingRequired.includes(key) && <span className="text-danger"> *</span>}
                  <select className="gph-input mt-1" value={columnMap[key] ?? ""}
                    onChange={(e) => setColumnMap((m) => ({ ...m, [key]: e.target.value || undefined }))}>
                    <option value="">—</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <button type="button" disabled={pending || REQUIRED_MISSING(columnMap)} onClick={() => file && parse(file, columnMap)} className="gph-btn-primary full mt-4">
              {pending ? "Analyse…" : "Continuer"}
            </button>
          </div>
        )}

        {step === "preview" && summary && (
          <>
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Lignes" value={summary.total} />
              <Stat label="Importables" value={summary.total - summary.duplicates - summary.toFix} tone="success" />
              <Stat label="Doublons" value={summary.duplicates} tone="warning" />
              <Stat label="À corriger" value={summary.toFix} tone="danger" />
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setFilter("tous")} className={`gph-chip${filter === "tous" ? " active" : ""}`}>Toutes<span className="count">{rows.length}</span></button>
              <button type="button" onClick={() => setFilter("problemes")} className={`gph-chip${filter === "problemes" ? " active" : ""}`}>Problèmes<span className="count">{rows.filter((r) => !r.importable).length}</span></button>
            </div>

            <div className="gph-card overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="border-b border-divider bg-bg font-semibold uppercase tracking-[0.02em] text-ink-3">
                  <tr>
                    <th className="px-2 py-2">L.{" "}</th>
                    <th className="px-2 py-2">Nom</th>
                    <th className="px-2 py-2">Prénom</th>
                    <th className="px-2 py-2">Sexe</th>
                    <th className="px-2 py-2">Naissance</th>
                    <th className="px-2 py-2">Téléphone</th>
                    <th className="px-2 py-2">Statut</th>
                    <th className="px-2 py-2">Poste</th>
                    <th className="px-2 py-2">Groupe sg.</th>
                    <th className="px-2 py-2">Tuteur 1</th>
                    <th className="px-2 py-2">État</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => {
                    const isExcluded = excluded.has(r.rowNumber);
                    const ok = !isExcluded && localImportable(r) && !r.duplicateOf;
                    return (
                      <tr key={r.rowNumber} className={`border-b border-divider last:border-none ${isExcluded ? "opacity-40" : ""}`}>
                        <td className="px-2 py-1.5 text-ink-3">{r.rowNumber}</td>
                        <td className="px-2 py-1.5"><input className={input} value={r.lastName} onChange={(e) => updateRow(r.rowNumber, { lastName: e.target.value.toUpperCase() })} /></td>
                        <td className="px-2 py-1.5"><input className={input} value={r.firstName} onChange={(e) => updateRow(r.rowNumber, { firstName: e.target.value })} /></td>
                        <td className="px-2 py-1.5">
                          <select className={input} value={r.sex ?? ""} onChange={(e) => updateRow(r.rowNumber, { sex: e.target.value })}>
                            <option value="">—</option>
                            {Object.entries(SEXES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5"><input type="date" className={input} value={r.birthDate ?? ""} onChange={(e) => updateRow(r.rowNumber, { birthDate: e.target.value || null })} /></td>
                        <td className="px-2 py-1.5"><input className={input} value={r.phone ?? ""} onChange={(e) => updateRow(r.rowNumber, { phone: e.target.value || null })} /></td>
                        <td className="px-2 py-1.5">
                          <select className={input} value={r.status} onChange={(e) => updateRow(r.rowNumber, { status: e.target.value })}>
                            {Object.entries(MEMBER_STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select className={input} value={r.position} onChange={(e) => updateRow(r.rowNumber, { position: e.target.value })}>
                            {Object.entries(POSITIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select className={input} value={r.bloodGroup ?? "Inconnu"} onChange={(e) => updateRow(r.rowNumber, { bloodGroup: e.target.value })}>
                            {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-ink-3">{r.tutor1 ? `${r.tutor1.name}${r.tutor1.phone ? "" : " (sans tél.)"}` : "—"}</td>
                        <td className="px-2 py-1.5">
                          {r.duplicateOf ? <span className="gph-badge warning">Doublon {r.duplicateOf}</span>
                            : ok ? <span className="gph-badge success"><Check size={11} /> OK</span>
                            : <span className="gph-badge danger" title={r.issues.map((i) => i.message).join(" · ")}>À corriger</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          <button type="button" onClick={() => setExcluded((s) => {
                              const n = new Set(s);
                              if (n.has(r.rowNumber)) n.delete(r.rowNumber); else n.add(r.rowNumber);
                              return n;
                            })}
                            className="gph-icon-btn h-7 w-7" title={isExcluded ? "Réinclure" : "Exclure"} aria-label={isExcluded ? "Réinclure la ligne" : "Exclure la ligne"}>
                            {isExcluded ? <UserX size={13} /> : <X size={13} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-ink-3">
              Les lignes marquées « À corriger » ou « Doublon » seront ignorées et détaillées dans le compte rendu ; corrigez-les ici ou excluez-les.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setSummary(null); setRows([]); setFile(null); }} className="gph-btn-ghost flex-1">Annuler</button>
              <button type="button" disabled={pending} onClick={commit} className="gph-btn-primary flex-[2]">
                {pending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {pending ? "Import en cours…" : `Importer (${rows.length - excluded.size} ligne${rows.length - excluded.size > 1 ? "s" : ""})`}
              </button>
            </div>
          </>
        )}

        {step === "result" && report && (
          <div className="gph-card p-5">
            <div className="mb-3 flex items-center gap-2 text-base font-bold text-primary"><Check size={20} /> Import terminé</div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Importés" value={report.imported} tone="success" />
              <Stat label="Ignorés" value={report.skipped.length} tone={report.skipped.length ? "danger" : undefined} />
              <Stat label="Tuteurs liés" value={report.tutorsLinked} />
            </div>
            {report.tutorsSkipped > 0 && (
              <p className="mt-3 text-xs text-ink-3">{report.tutorsSkipped} tuteur(s) non créé(s) : téléphone manquant dans le fichier.</p>
            )}
            {report.skipped.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.03em] text-ink-3">Lignes ignorées</div>
                <ul className="flex flex-col gap-1.5">
                  {report.skipped.map((s) => (
                    <li key={s.rowNumber} className="rounded-lg bg-bg px-3 py-2 text-xs">
                      <span className="font-semibold">Ligne {s.rowNumber} · {s.name}</span>
                      <div className="text-ink-3">{s.reasons.join(" · ")}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <Link href="/membres" className="gph-btn-primary flex-1 justify-center">Voir les membres</Link>
              <button type="button" onClick={() => { setReport(null); setSummary(null); setRows([]); setFile(null); }} className="gph-btn-ghost flex-1">
                Nouvel import
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function REQUIRED_MISSING(map: Partial<Record<ColumnKey, string>>) {
  return !map.Noms || !map["Prénoms"] || !map.Sexe || !map.Date_Naissance;
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "danger" }) {
  const color = tone === "success" ? "var(--gph-success)" : tone === "warning" ? "var(--gph-warning)" : tone === "danger" ? "var(--gph-danger)" : undefined;
  return (
    <div className="gph-card px-2.5 py-3 text-center">
      <div className="text-xl font-bold tracking-[-0.02em]" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold text-ink-3">{label}</div>
    </div>
  );
}
