"use client";
import { Check, Search } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { recordPassage } from "@/app/actions/grades";
import { BeltBadge } from "@/components/belt-badge";
import { ImageInput } from "@/components/image-input";
import { FormTopBar } from "@/components/ui";

type MemberOpt = { id: string; name: string; gridName: string; current: string | null; nextId: string | null };
type GradeOpt = { id: string; kind: string; label: string; mainColor: string; stripeColor: string | null; stripeCount: number };

export function PassageForm({ members, grids, today, initialMemberId, mentions }: {
  members: MemberOpt[]; grids: { name: string; grades: GradeOpt[] }[]; today: string; initialMemberId: string; mentions: string[];
}) {
  const [state, action, pending] = useActionState(recordPassage, undefined);
  const [memberId, setMemberId] = useState(members.some((m) => m.id === initialMemberId) ? initialMemberId : "");
  const member = members.find((m) => m.id === memberId);
  const [gradeId, setGradeId] = useState(member?.nextId ?? "");
  const [q, setQ] = useState("");
  const [gridName, setGridName] = useState(member?.gridName ?? "Enfant");
  const e = state?.errors ?? {};
  const allGrades = grids.flatMap((g) => g.grades);
  const grade = allGrades.find((g) => g.id === gradeId);
  const matches = useMemo(
    () => (q.trim().length < 2 ? [] : members.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)),
    [q, members],
  );

  const pick = (m: MemberOpt) => {
    setMemberId(m.id);
    setGradeId(m.nextId ?? "");
    setGridName(m.gridName);
    setQ("");
  };

  return (
    <form action={action}>
      <FormTopBar cancelHref={memberId ? `/grades/athletes/${memberId}` : "/grades"} title="Passage de grade" />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="gradeId" value={gradeId} />
      <div className="flex flex-col gap-4 px-4 lg:mx-auto lg:max-w-2xl">
        <div>
          <label className="gph-label">Athlète</label>
          {member ? (
            <div className="gph-card flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{member.name}</div>
                <div className="text-xs text-ink-3">Actuel : {member.current ?? "aucun grade"} · grille {member.gridName}</div>
              </div>
              <button type="button" className="text-xs font-semibold text-primary" onClick={() => setMemberId("")}>Changer</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Rechercher un athlète" className="gph-input with-icon" aria-invalid={!!e.memberId} />
              </div>
              {matches.length > 0 && (
                <div className="gph-card mt-1 flex flex-col p-1">
                  {matches.map((m) => (
                    <button type="button" key={m.id} onClick={() => pick(m)} className="rounded-lg px-3 py-2.5 text-left hover:bg-bg">
                      <span className="block text-sm font-semibold">{m.name}</span>
                      <span className="text-xs text-ink-3">{m.current ?? "Aucun grade"}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {e.memberId && <p className="mt-1.5 text-xs font-semibold text-danger">{e.memberId}</p>}
        </div>

        <div>
          <label className="gph-label">Nouveau grade</label>
          <div className="mb-2 flex gap-2">
            {grids.map((g) => (
              <button type="button" key={g.name} onClick={() => setGridName(g.name)} className={`gph-chip${gridName === g.name ? " active" : ""}`}>
                Grille {g.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {grids.find((g) => g.name === gridName)?.grades.map((g) => (
              <button type="button" key={g.id} onClick={() => setGradeId(g.id)} aria-pressed={gradeId === g.id}
                className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold"
                style={{ borderColor: gradeId === g.id ? "var(--gph-primary)" : "var(--gph-divider)", background: gradeId === g.id ? "var(--gph-primary-soft)" : "#fff" }}>
                <BeltBadge grade={g} width={40} height={11} />
                <span className="flex-1">{g.label}</span>
                {gradeId === g.id && <Check size={14} className="text-primary" />}
              </button>
            ))}
          </div>
          {e.gradeId && <p className="mt-1.5 text-xs font-semibold text-danger">{e.gradeId}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="gph-label" htmlFor="date">Date</label>
            <input id="date" name="date" type="date" required defaultValue={today} max={today} className="gph-input" />
          </div>
          <div>
            <label className="gph-label" htmlFor="mention">Mention <span className="opt">(optionnel)</span></label>
            <select id="mention" name="mention" className="gph-input" defaultValue="">
              <option value="">—</option>
              {mentions.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="gph-label" htmlFor="jury">Jury / examinateur <span className="opt">(optionnel)</span></label>
          <input id="jury" name="jury" maxLength={200} className="gph-input" />
        </div>
        {grade && grade.kind !== "KEUP" && (
          <div>
            <label className="gph-label" htmlFor="certificate">N° de certificat Kukkiwon</label>
            <input id="certificate" name="certificate" required maxLength={60} className="gph-input font-mono" aria-invalid={!!e.certificate} />
            {e.certificate && <p className="mt-1.5 text-xs font-semibold text-danger">{e.certificate}</p>}
          </div>
        )}
        <div>
          <label className="gph-label" htmlFor="observation">Observation <span className="opt">(optionnel)</span></label>
          <textarea id="observation" name="observation" rows={3} maxLength={1000} className="gph-input" />
        </div>
        <div>
          <label className="gph-label">Justificatif <span className="opt">(photo du diplôme, optionnel)</span></label>
          <ImageInput name="proofUrl" maxSize={1200} label="Photographier le diplôme" />
        </div>

        {e.confirmLower && (
          <label className="flex items-start gap-2 rounded-xl bg-[var(--gph-warning-soft)] p-3 text-sm font-semibold text-[var(--gph-warning-ink)]">
            <input type="checkbox" name="confirmLower" value="1" className="mt-1" />
            Je confirme l&apos;enregistrement d&apos;un grade inférieur (correction d&apos;erreur).
          </label>
        )}
        {state?.error && <p role="alert" className="gph-badge danger justify-center py-2.5 text-[13px] whitespace-normal">{state.error}</p>}
        <button className="gph-btn-primary full mb-4" disabled={pending || !memberId || !gradeId}>
          <Check size={18} strokeWidth={2.5} /> Enregistrer le passage
        </button>
      </div>
    </form>
  );
}
