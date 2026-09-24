import { Award, CalendarClock, CalendarDays, ChevronRight, Download, Info, MapPin, QrCode, Trophy, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { Avatar } from "@/components/avatar";
import { BeltBadge } from "@/components/belt-badge";
import { EspaceChildPicker } from "@/components/espace-child-picker";
import { Icon } from "@/components/icon";
import { ProgressBar, SectionTitle } from "@/components/ui";
import { ageAt, isMinor } from "@/lib/categories";
import { db } from "@/lib/db";
import { getAssociation } from "@/lib/dal";
import { DUE_STATUS_META, FEE_META, fullName, pctTone, type DueStatus, type FeeCode } from "@/lib/domain";
import { ensureDues } from "@/lib/fees";
import { formatAriary, formatDate, MONTH_LABELS, schoolMonths } from "@/lib/format";
import { currentGrades, gradeShortLabel } from "@/lib/grades";
import { qrPayload } from "@/lib/qr";
import { espaceContext, memberSessionsWhere, relevantEvents, withChild } from "../context";

export const metadata: Metadata = { title: "Mon espace" };

const OUTCOME_LABELS: Record<string, string> = {
  GOLD: "🥇 Or", SILVER: "🥈 Argent", BRONZE: "🥉 Bronze", PARTICIPATION: "Participation", ELIMINATED: "Éliminé",
};
const hhmm = (t: string | null) => (t ? t.replace(":", "h") : "");

export default async function EspaceHome(props: PageProps<"/mon-espace">) {
  const sp = await props.searchParams;
  const { user, children, selected } = await espaceContext(sp.enfant);

  if (!selected) {
    return (
      <div className="px-4 pt-6">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Mon espace</h1>
        <div className="gph-card mt-4 p-6 text-center text-sm text-ink-3">
          Aucun athlète n&apos;est encore associé à votre compte. Contactez le secrétariat du club.
        </div>
      </div>
    );
  }

  const association = await getAssociation();
  const schoolYear = association.currentSchoolYear;
  await ensureDues(schoolYear);
  const member = await db.member.findUniqueOrThrow({ where: { id: selected.id }, include: { group: true } });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yearStart = new Date(Number(schoolYear.slice(0, 4)), association.schoolYearStartMon - 1, 1);

  const [nextSession, events, lastPresence, pastSessions, dues, payments, grades, lastResult, ownAccount] = await Promise.all([
    db.session.findFirst({ where: memberSessionsWhere(member.groupId, today), orderBy: [{ date: "asc" }, { startTime: "asc" }] }),
    relevantEvents(member, today),
    db.attendance.findFirst({
      where: { memberId: member.id, status: "PRESENT" }, orderBy: { scannedAt: "desc" },
      include: { session: true, eventDay: { include: { event: true } } },
    }),
    db.session.findMany({
      where: { ...memberSessionsWhere(member.groupId, yearStart, new Date()) },
      orderBy: { date: "desc" },
      include: { attendances: { where: { memberId: member.id } } },
    }),
    db.due.findMany({ where: { memberId: member.id, OR: [{ schoolYear }, { eventKey: { not: "" }, status: { not: "PAID" } }] }, include: { feeType: true, event: true } }),
    db.payment.findMany({
      where: { memberId: member.id, cancelled: false }, orderBy: { date: "desc" }, take: 5,
      include: { allocations: { include: { due: { include: { feeType: true } } } } },
    }),
    currentGrades([member.id]),
    db.result.findFirst({ where: { memberId: member.id }, orderBy: { competition: { startDate: "desc" } }, include: { competition: true } }),
    db.user.findFirst({ where: { memberId: member.id } }),
  ]);

  // ─── Présences (séances du groupe depuis la rentrée, excusés exclus) ───
  const counted = pastSessions.filter((s) => s.attendances[0]?.status !== "EXCUSED");
  const presentCount = counted.filter((s) => s.attendances[0]?.status === "PRESENT").length;
  const rate = counted.length ? Math.round((presentCount / counted.length) * 100) : null;
  const tone = rate === null ? "success" : pctTone(rate, association.thresholdGreen, association.thresholdOrange);

  // ─── Cotisations : en retard = échue et non soldée ───
  const order = schoolMonths(association.schoolYearStartMon);
  const nowIdx = order.indexOf(new Date().getMonth() + 1);
  const isDueNow = (d: (typeof dues)[number]) => d.month === 0 || order.indexOf(d.month) <= nowIdx;
  const overdue = dues.filter((d) => d.status !== "PAID" && isDueNow(d));
  const overdueTotal = overdue.reduce((s, d) => s + d.amountDue - d.amountPaid, 0);
  const byType = (code: FeeCode) => dues.filter((d) => d.feeType.code === code && d.eventKey === "");
  const grade = grades.get(member.id);
  const name = fullName(member);
  const nextEvent = events[0];
  const isSelf = user.memberId === member.id;
  const qrSvg = await QRCode.toString(qrPayload(member.qrToken), { type: "svg", margin: 1, width: 240, color: { dark: "#1A1A2E" } });

  return (
    <>
      <header className="flex items-center gap-3 px-5 pb-3 pt-3.5">
        <Avatar name={name} size={48} photoUrl={member.photoUrl} />
        <div className="min-w-0">
          <h1 className="m-0 truncate text-[24px] font-bold leading-tight tracking-[-0.02em]">{isSelf ? "Mon espace" : name}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-[13px] font-medium text-ink-3">
            {member.group?.name ?? "Sans groupe"}
            {grade && (
              <span className="inline-flex items-center gap-1.5">
                · <BeltBadge grade={{ ...grade.grade }} width={36} height={10} title={grade.grade.beltLabel} /> {gradeShortLabel(grade.grade)}
              </span>
            )}
          </div>
        </div>
      </header>

      <EspaceChildPicker items={children.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, photoUrl: c.photoUrl }))} selectedId={member.id} />

      <div className="flex flex-col gap-3.5 px-4">
        {user.profile === "PARENT" && ageAt(member.birthDate) >= 18 && !ownAccount && (
          <div className="flex gap-2.5 rounded-xl bg-[var(--gph-droit-soft)] p-3 text-[13px] font-medium text-[var(--gph-droit)]">
            <Info size={16} className="mt-0.5 flex-none" />
            {member.firstName} est majeur(e) : le club peut lui créer son propre compte. Vous resterez associé(e) sauf demande contraire.
          </div>
        )}

        {/* ─── Synthèse ─── */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <SummaryTile Icon={CalendarClock} label="Prochaine séance"
            value={nextSession ? `${formatDate(nextSession.date)}${nextSession.startTime ? ` · ${hhmm(nextSession.startTime)}` : ""}` : "—"}
            sub={nextSession?.title} />
          <SummaryTile Icon={CalendarDays} label="Dernière présence"
            value={lastPresence?.scannedAt ? formatDate(lastPresence.scannedAt) : "—"}
            sub={lastPresence?.session?.title ?? lastPresence?.eventDay?.event.title} />
          <SummaryTile Icon={Wallet} label="Cotisations en retard" tone={overdue.length ? "danger" : "success"}
            value={overdue.length ? formatAriary(overdueTotal) : "À jour"} sub={overdue.length ? `${overdue.length} échéance${overdue.length > 1 ? "s" : ""}` : undefined} />
          <SummaryTile Icon={Trophy} label="Dernier résultat"
            value={lastResult ? (lastResult.outcome === "RANK" ? `${lastResult.rank}e` : OUTCOME_LABELS[lastResult.outcome] ?? lastResult.outcome) : "—"}
            sub={lastResult?.competition.name} />
        </div>

        {/* ─── Événements ─── */}
        {nextEvent && (
          <>
            <SectionTitle link={{ href: withChild("/mon-espace/evenements", member.id), label: `Tous (${events.length})` }}>Prochain événement</SectionTitle>
            <Link href={withChild("/mon-espace/evenements", member.id)} className="gph-card flex items-center gap-3 p-3.5">
              <span className="h-10 w-1.5 flex-none rounded-full" style={{ background: nextEvent.type.color }} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-ink-3">
                  {formatDate(nextEvent.startDate)}
                  {+nextEvent.endDate - +nextEvent.startDate > 864e5 && ` → ${formatDate(nextEvent.endDate)}`} · {nextEvent.type.label}
                </div>
                <div className="truncate text-[15px] font-bold">{nextEvent.title}</div>
                {nextEvent.location && <div className="flex items-center gap-1 text-xs text-ink-3"><MapPin size={11} />{nextEvent.location}</div>}
              </div>
              {nextEvent.registrations[0] ? (
                <span className={`gph-badge ${{ YES: "success", NO: "danger", MAYBE: "warning", PENDING: "neutral" }[nextEvent.registrations[0].response] ?? "neutral"}`}>
                  {{ YES: "Participe", NO: "Absent", MAYBE: "Peut-être", PENDING: "À répondre" }[nextEvent.registrations[0].response]}
                </span>
              ) : nextEvent.participationMode !== "OPEN" ? <span className="gph-badge warning">À répondre</span> : null}
              <ChevronRight size={18} className="text-ink-3" />
            </Link>
          </>
        )}

        <div className="grid gap-3.5 lg:grid-cols-2">
          {/* ─── Présences ─── */}
          <section>
            <SectionTitle link={{ href: `/membres/${member.id}/presences`, label: "Historique" }}>Présences</SectionTitle>
            <div className="gph-card p-3.5">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[13px] font-semibold text-ink-2">Assiduité {schoolYear}</span>
                <span className={`gph-badge ${tone}`}>{rate === null ? "—" : `${rate}%`}</span>
              </div>
              <ProgressBar pct={rate ?? 0} tone={tone} height={8} />
              <div className="mt-1.5 text-xs font-medium text-ink-3">{presentCount} séance{presentCount > 1 ? "s" : ""} sur {counted.length}</div>
              <div className="mt-3 flex gap-1.5">
                {pastSessions.slice(0, 8).reverse().map((s) => {
                  const st = s.attendances[0]?.status;
                  return (
                    <div key={s.id} title={`${s.title} — ${formatDate(s.date)}`} className="h-7 flex-1 rounded-md"
                      style={{
                        background: st === "PRESENT" ? "var(--gph-success)" : st === "EXCUSED" ? "var(--gph-track)" : "var(--gph-danger-soft)",
                        border: !st || st === "ABSENT" ? "1px solid var(--gph-danger)" : "none",
                      }} />
                  );
                })}
              </div>
            </div>
          </section>

          {/* ─── Grades & palmarès ─── */}
          <section>
            <SectionTitle>Grades et palmarès</SectionTitle>
            <div className="gph-card divide-y divide-divider">
              <Link href={`/grades/athletes/${member.id}`} className="flex items-center gap-3 p-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><Award size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{grade ? grade.grade.beltLabel : "Aucun grade enregistré"}</span>
                  <span className="text-xs text-ink-3">{grade ? `${gradeShortLabel(grade.grade)} · depuis le ${formatDate(grade.date)}` : "Historique des passages"}</span>
                </span>
                {grade && <BeltBadge grade={grade.grade} width={48} height={12} title={grade.grade.beltLabel} />}
                <ChevronRight size={18} className="text-ink-3" />
              </Link>
              <Link href={`/palmares/athletes/${member.id}`} className="flex items-center gap-3 p-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--gph-warning-soft)] text-[var(--gph-warning-ink)]"><Trophy size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Palmarès</span>
                  <span className="text-xs text-ink-3">{lastResult ? `Dernier : ${lastResult.competition.name}` : "Compétitions et médailles"}</span>
                </span>
                <ChevronRight size={18} className="text-ink-3" />
              </Link>
            </div>
          </section>
        </div>

        {/* ─── Cotisations ─── */}
        <section>
          <SectionTitle>Cotisations {schoolYear}</SectionTitle>
          <div className="gph-card p-3.5">
            {(["DROIT", "PASSPORT"] as const).map((code) => {
              const d = byType(code)[0];
              const meta = FEE_META[code];
              const st = DUE_STATUS_META[(d?.status ?? "UNPAID") as DueStatus];
              return (
                <div key={code} className="mb-3 flex items-center gap-3 border-b border-divider pb-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: meta.soft, color: meta.color }}>
                    <Icon name={meta.icon} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">{code === "DROIT" ? "Droit" : "Passport"}</div>
                    <div className="gph-amount text-[11px] font-medium text-ink-3">
                      {d ? (d.status === "PARTIAL" ? `${formatAriary(d.amountPaid)} / ${formatAriary(d.amountDue)}` : formatAriary(d.amountDue)) : "—"}
                    </div>
                  </div>
                  {d && <span className={`gph-badge ${st.tone}`}><Icon name={st.icon} size={11} strokeWidth={3} />{st.label}</span>}
                </div>
              );
            })}
            {(() => {
              const eco = byType("ECOLAGE");
              const paid = eco.filter((d) => d.status === "PAID").length;
              return (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: FEE_META.ECOLAGE.soft, color: FEE_META.ECOLAGE.color }}>
                    <Icon name="graduation-cap" size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="text-[13px] font-semibold">Écolage</span>
                      <span className="gph-amount text-[11px] font-semibold text-ink-3">{paid} / {eco.length || 12} mois</span>
                    </div>
                    <div className="flex gap-[3px]">
                      {order.map((m) => {
                        const d = eco.find((x) => x.month === m);
                        const st = d?.status;
                        const future = order.indexOf(m) > nowIdx;
                        return (
                          <div key={m} title={`${MONTH_LABELS[m - 1]} — ${st ? DUE_STATUS_META[st as DueStatus].label : "—"}`} className="h-[18px] flex-1 rounded"
                            style={{
                              background: st === "PAID" ? "var(--gph-success)" : st === "PARTIAL" ? "var(--gph-warning)" : future || !d ? "var(--gph-divider)" : "var(--gph-danger-soft)",
                              border: st === "UNPAID" && !future ? "1px solid var(--gph-danger)" : "none",
                            }} />
                        );
                      })}
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] font-semibold text-ink-3">
                      <span>{MONTH_LABELS[order[0] - 1].slice(0, 3)}</span><span>{MONTH_LABELS[order[11] - 1].slice(0, 3)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            {overdue.some((d) => d.eventKey) && (
              <div className="mt-3 border-t border-divider pt-3 text-xs font-medium text-ink-2">
                Frais d&apos;événement à régler : {overdue.filter((d) => d.eventKey).map((d) => `${d.event?.title ?? "Événement"} (${formatAriary(d.amountDue - d.amountPaid)})`).join(", ")}
              </div>
            )}
          </div>

          {payments.length > 0 && (
            <div className="gph-card mt-2.5 overflow-hidden">
              {payments.map((p) => (
                <a key={p.id} href={`/api/recus/${p.id}`} className="flex items-center gap-3 border-b border-divider px-3.5 py-2.5 last:border-none">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">{[...new Set(p.allocations.map((a) => a.due.feeType.label))].join(", ") || "Paiement"}</div>
                    <div className="text-[11px] font-medium text-ink-3">{formatDate(p.date)} · <span className="gph-amount">{p.receiptNo}</span></div>
                  </div>
                  <span className="gph-amount text-[13px] font-bold">{formatAriary(p.totalAmount)}</span>
                  <Download size={16} className="text-primary" aria-label="Télécharger le reçu" />
                </a>
              ))}
            </div>
          )}
        </section>

        {/* ─── QR code ─── */}
        <section>
          <SectionTitle>{isSelf ? "Mon QR code" : `QR code de ${member.firstName}`}</SectionTitle>
          <details className="gph-card p-3.5" open={isSelf}>
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><QrCode size={16} /></span>
              <span className="flex-1 text-sm font-semibold">À présenter à l&apos;entraîneur pour pointer la présence</span>
              <span className="gph-amount text-xs text-ink-3">{member.matricule}</span>
            </summary>
            <div className="mx-auto mt-4 w-full max-w-[260px] rounded-2xl bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            {isMinor(member.birthDate) && !isSelf && (
              <p className="mt-2 text-center text-xs text-ink-3">Vous pouvez l&apos;imprimer ou le montrer depuis votre téléphone.</p>
            )}
          </details>
        </section>
      </div>
    </>
  );
}

function SummaryTile({ Icon: I, label, value, sub, tone }: {
  Icon: typeof Award; label: string; value: string; sub?: string | null; tone?: "success" | "danger";
}) {
  return (
    <div className="gph-card min-w-0 p-3">
      <I size={16} className="text-primary" />
      <div className="mt-1.5 truncate text-[15px] font-bold tracking-[-0.01em]"
        style={{ color: tone === "danger" ? "var(--gph-danger-ink)" : tone === "success" ? "var(--gph-success-ink)" : undefined }}>{value}</div>
      <div className="text-[11px] font-semibold text-ink-3">{label}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}
