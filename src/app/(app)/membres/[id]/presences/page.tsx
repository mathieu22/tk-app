import { Calendar, Check, Minus, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, FilterChips, SectionTitle } from "@/components/ui";
import { memberAttendance, type AttendanceStatus } from "@/lib/attendance";
import { db } from "@/lib/db";
import { getAssociation, requireMemberAccess } from "@/lib/dal";
import { fullName, pctTone } from "@/lib/domain";
import { formatDate, MONTH_LABELS } from "@/lib/format";
import { isStaff } from "@/lib/permissions";
import { AttendanceBars } from "./bars";

export const metadata: Metadata = { title: "Historique des présences" };

const TONE_COLOR = { success: "var(--gph-success)", warning: "var(--gph-warning)", danger: "var(--gph-danger)" };
const STATUS_META: Record<AttendanceStatus, { label: string; tone: string; Icon: typeof Check }> = {
  PRESENT: { label: "Présent", tone: "success", Icon: Check },
  ABSENT: { label: "Absent", tone: "danger", Icon: X },
  EXCUSED: { label: "Excusé", tone: "neutral", Icon: Minus },
};

function previousYear(sy: string) {
  const y = Number(sy.slice(0, 4));
  return `${y - 1}-${y}`;
}

/** Historique des présences d'un membre (US-2.4) — séances et événements séparés (US-1.11). */
export default async function MemberAttendancePage({ params, searchParams }: PageProps<"/membres/[id]/presences">) {
  const { id } = await params;
  const user = await requireMemberAccess(id);
  const sp = await searchParams;
  const association = await getAssociation();
  const years = [association.currentSchoolYear, previousYear(association.currentSchoolYear)];
  const year = years.includes(String(sp.annee)) ? String(sp.annee) : years[0];
  const tab = sp.vue === "evenements" ? "evenements" : "seances";

  const member = await db.member.findUnique({ where: { id }, select: { firstName: true, lastName: true, archived: true } });
  if (!member || member.archived) notFound();
  const att = await memberAttendance(id, year, association.schoolYearStartMon);
  const rate = tab === "seances" ? att.sessionRate : att.eventRate;
  const tone = pctTone(rate.pct, association.thresholdGreen, association.thresholdOrange);
  const rows = tab === "seances" ? att.sessions : att.events;
  const back = isStaff(user.profile) ? `/membres/${id}` : "/mon-espace";

  // Heatmap : jours de séance colorés selon le statut (S)
  const byDay = new Map<string, AttendanceStatus>();
  for (const s of att.sessions) byDay.set(s.date.toDateString(), s.status);
  const start = new Date(Number(year.slice(0, 4)), association.schoolYearStartMon - 1, 1);
  const months = Array.from({ length: 12 }, (_, i) => new Date(start.getFullYear(), start.getMonth() + i, 1));

  const q = (p: Record<string, string>) => `?${new URLSearchParams({ annee: year, vue: tab, ...p })}`;

  return (
    <>
      <div className="flex items-center gap-3 px-4 pb-2 pt-1.5">
        <BackButton href={back} />
        <div className="min-w-0">
          <h1 className="m-0 truncate text-[22px] font-bold tracking-[-0.02em]">Présences</h1>
          <div className="text-[13px] font-medium text-ink-3">{fullName(member)}</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-6">
        <div className="flex flex-wrap gap-2">
          <FilterChips active={year} hrefFor={(v) => q({ annee: v })} options={years.map((y) => ({ value: y, label: y }))} />
          <FilterChips active={tab} hrefFor={(v) => q({ vue: v })} options={[
            { value: "seances", label: "Entraînements", count: att.sessions.length },
            { value: "evenements", label: "Événements", count: att.events.length },
          ]} />
        </div>

        <div className="lg:grid lg:grid-cols-2 lg:gap-4">
          {/* Jauge */}
          <div className="gph-card mb-3 flex items-center gap-4 p-4 lg:mb-0">
            <Gauge pct={rate.pct} color={TONE_COLOR[tone]} />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3">
                Taux {tab === "seances" ? "d'entraînement" : "aux événements"}
              </div>
              <div className="mt-1 text-2xl font-bold tracking-[-0.02em]">{rate.present}<span className="text-base text-ink-3"> / {rate.total}</span></div>
              <div className="text-xs font-medium text-ink-3">{tab === "seances" ? "séances" : "événements"} présents · excusés non comptés</div>
            </div>
          </div>

          {tab === "seances" && (
            <div className="gph-card p-4">
              <div className="mb-2 text-[13px] font-semibold">Par mois</div>
              <AttendanceBars data={att.byMonth.map((b) => ({ label: MONTH_LABELS[b.month - 1].slice(0, 3), pct: b.pct, present: b.present, total: b.total }))}
                green={association.thresholdGreen} orange={association.thresholdOrange} />
            </div>
          )}
        </div>

        {tab === "seances" && (
          <div className="gph-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold">Calendrier</span>
              <span className="flex gap-3 text-[10px] font-semibold text-ink-3">
                <Legend color="var(--gph-success)" label="Présent" />
                <Legend color="var(--gph-danger)" label="Absent" />
                <Legend color="var(--gph-ink-3)" label="Excusé" />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {months.map((m) => {
                const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
                const offset = (m.getDay() + 6) % 7; // semaine commençant le lundi
                return (
                  <div key={m.toISOString()}>
                    <div className="mb-1 text-[10px] font-semibold text-ink-3">{MONTH_LABELS[m.getMonth()].slice(0, 3)} {m.getFullYear()}</div>
                    <div className="grid grid-cols-7 gap-[2px]">
                      {Array.from({ length: offset }, (_, i) => <span key={`o${i}`} />)}
                      {Array.from({ length: days }, (_, i) => {
                        const d = new Date(m.getFullYear(), m.getMonth(), i + 1);
                        const st = byDay.get(d.toDateString());
                        return (
                          <span key={i} title={st ? `${formatDate(d)} · ${STATUS_META[st].label}` : formatDate(d)}
                            className="aspect-square rounded-[2px]"
                            style={{ background: st === "PRESENT" ? "var(--gph-success)" : st === "ABSENT" ? "var(--gph-danger)" : st === "EXCUSED" ? "var(--gph-ink-3)" : "var(--gph-track)" }} />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <SectionTitle>{tab === "seances" ? "Séances" : "Événements"}</SectionTitle>
        {rows.length === 0 ? (
          <div className="gph-card p-6 text-center text-sm text-ink-3">Aucune donnée pour cette année.</div>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {rows.map((r) => {
              const meta = STATUS_META[r.status];
              const inner = (
                <>
                  <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-[10px] gph-badge ${meta.tone}`} style={{ padding: 0 }}>
                    <meta.Icon size={16} strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{r.title}</div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
                      <Calendar size={11} /> {formatDate(r.date)}
                      {"type" in r && <><span>·</span><span style={{ color: r.color }}>{r.type}</span></>}
                    </div>
                  </div>
                  <span className={`gph-badge ${meta.tone}`}>{meta.label}</span>
                </>
              );
              const href = isStaff(user.profile) ? ("type" in r ? `/presence/evenements/${r.id}` : `/presence/${r.id}`) : null;
              return (
                <li key={r.id}>
                  {href ? <Link href={href} className="gph-card flex items-center gap-3 p-3">{inner}</Link> : <div className="gph-card flex items-center gap-3 p-3">{inner}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

function Gauge({ pct, color }: { pct: number; color: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[84px] w-[84px] flex-none">
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden>
        <circle cx="42" cy="42" r={r} stroke="var(--gph-track)" strokeWidth="9" fill="none" />
        <circle cx="42" cy="42" r={r} stroke={color} strokeWidth="9" fill="none" strokeLinecap={pct > 0 ? "round" : "butt"}
          strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 42 42)" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-lg font-bold">{pct}%</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />{label}</span>;
}
