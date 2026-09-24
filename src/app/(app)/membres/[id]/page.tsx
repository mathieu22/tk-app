import {
  Award, CalendarDays, Check, ChevronLeft, ChevronRight, Download, Droplet, Eye, Globe, HeartPulse, Mail, MessageCircle,
  MessageSquare, Pencil, Phone, Printer, QrCode, Scale, Trophy, UserRound, Users, X,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Avatar } from "@/components/avatar";
import { BeltBadge } from "@/components/belt-badge";
import { Icon } from "@/components/icon";
import {
  CreateAccountButton, DeleteMemberButton, HardDeleteButton, InviteParentButton, RegenerateQrButton, ShareQrButton,
} from "@/components/member-actions";
import { SectionTitle } from "@/components/ui";
import { memberAttendance } from "@/lib/attendance";
import { ageAt, competitionProfile, getSeason, isMinor } from "@/lib/categories";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { DUE_STATUS_META, FEE_META, fullName, POSITIONS, SEXES, type DueStatus, type Position } from "@/lib/domain";
import { ensureDues } from "@/lib/fees";
import { formatAriary, formatDate, formatPhone, schoolMonths } from "@/lib/format";
import { eligibility, gradeShortLabel, nextGrade } from "@/lib/grades";
import { RELATIONSHIPS, type Relationship } from "@/lib/parents";
import { can } from "@/lib/permissions";
import { qrPayload } from "@/lib/qr";

type Props = PageProps<"/membres/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requirePermission("member.view"); // pas de fuite du nom dans <title>
  const m = await db.member.findUnique({ where: { id: (await params).id }, select: { firstName: true, lastName: true } });
  return { title: m ? fullName(m) : "Membre" };
}

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

type Contact = { label: string; phone: string | null; email?: string | null; facebook?: string | null };

export default async function MemberPage({ params }: Props) {
  const user = await requirePermission("member.view");
  const { id } = await params;
  const member = await db.member.findUnique({
    where: { id },
    include: {
      group: true,
      user: { select: { id: true } },
      parents: { orderBy: { rank: "asc" }, include: { parent: { include: { user: { select: { lastLoginAt: true } } } } } },
      gradeHistory: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 1, include: { grade: { include: { grid: true } } } },
      weighIns: { orderBy: { date: "desc" }, take: 1 },
    },
  });
  if (!member || member.archived) notFound();

  const association = await getAssociation();
  const schoolYear = association.currentSchoolYear;
  const showFees = can(user, "payment.viewAll");
  if (showFees) await ensureDues(schoolYear);

  const [att, season] = await Promise.all([
    memberAttendance(id, schoolYear, association.schoolYearStartMon),
    getSeason(),
  ]);
  const history = att.sessions.slice(0, 5);
  const chrono = [...history].reverse();
  const presentCount = history.filter((h) => h.status === "PRESENT").length;

  const dues = showFees
    ? await db.due.findMany({ where: { memberId: id, schoolYear, eventKey: "" }, include: { feeType: true } })
    : [];
  const annual = (code: "DROIT" | "PASSPORT") => dues.find((d) => d.feeType.code === code);
  const ecolage = new Map(dues.filter((d) => d.feeType.code === "ECOLAGE").map((d) => [d.month, d]));
  const ecolagePaid = [...ecolage.values()].filter((d) => d.status === "PAID").length;

  // Grade actuel + éligibilité au suivant (US-4.2, 4.4)
  const current = member.gradeHistory[0] ?? null;
  const next = current ? await nextGrade(current.gradeId) : null;
  const elig = current && next
    ? eligibility({
        currentSince: current.date, currentMinMonths: current.grade.minMonths, birthDate: member.birthDate,
        target: next, attendancePct: att.sessionRate.total ? att.sessionRate.pct : null,
      })
    : null;
  const profile = season
    ? competitionProfile(season, member, member.weighIns[0] ?? null, { alertKg: association.weightAlertKg, maxDays: association.weighInMaxDays })
    : null;

  const name = fullName(member);
  const payload = qrPayload(member.qrToken);
  const [qrSvg, qrPng] = await Promise.all([
    QRCode.toString(payload, { type: "svg", margin: 1, width: 260, color: { dark: "#1A1A2E" } }),
    QRCode.toDataURL(payload, { margin: 2, width: 720, color: { dark: "#1A1A2E" } }),
  ]);
  const canEdit = can(user, "member.edit");
  const minor = isMinor(member.birthDate);
  const age = ageAt(member.birthDate);

  // Destinataires possibles de « Contacter » : pour un mineur, l'athlète, le Tuteur 1 et le Tuteur 2 (US-2.3).
  const contacts: Contact[] = [
    { label: minor ? `${member.firstName} (athlète)` : name, phone: member.phone, email: member.email, facebook: member.facebook },
    ...member.parents.map((l) => ({
      label: `Tuteur ${l.rank} · ${l.parent.firstName} ${l.parent.lastName}`, phone: l.parent.phone, email: l.parent.email, facebook: null,
    })),
  ].filter((c) => c.phone || c.email || c.facebook);

  const infoRows = [
    { icon: Phone, label: "Téléphone", val: member.phone ? formatPhone(member.phone) : "—" },
    { icon: Mail, label: "Email", val: member.email ?? "—" },
    { icon: CalendarDays, label: "Inscription", val: formatDate(member.joinedAt) },
    { icon: UserRound, label: "Naissance", val: `${formatDate(member.birthDate)} · ${age} ans · ${SEXES[member.sex as "M" | "F"] ?? member.sex}${member.birthPlace ? ` · ${member.birthPlace}` : ""}` },
    ...(member.nationality ? [{ icon: Globe, label: "Nationalité", val: member.nationality }] : []),
    ...(member.address ? [{ icon: UserRound, label: "Adresse", val: member.address }] : []),
  ];

  return (
    <>
      {/* Hero */}
      <div className="relative overflow-hidden bg-[linear-gradient(160deg,var(--gph-primary)_0%,var(--gph-primary-deep)_60%,#0a3010_100%)] px-5 pb-7 pt-3 text-white md:rounded-2xl">
        <div className="absolute -right-10 -top-10 h-[180px] w-[180px] rounded-full bg-[rgba(76,175,80,0.18)]" />
        <div className="relative mb-2 flex justify-between">
          <Link href="/membres" aria-label="Retour" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <ChevronLeft size={18} />
          </Link>
          <span className="rounded-full bg-white/20 px-2.5 py-1.5 font-mono text-[11px] font-semibold">{member.matricule}</span>
        </div>
        <div className="relative flex flex-col items-center gap-3">
          <Avatar name={name} size={84} photoUrl={member.photoUrl} />
          <div className="text-center">
            <div className="text-[22px] font-bold tracking-[-0.02em]">{name}</div>
            <div className="mt-1.5 inline-flex items-center gap-[5px] rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur">
              <span className="gph-dot" style={{ background: "var(--gph-accent)" }} />
              {POSITIONS[member.position as Position] ?? member.position}
              {member.group && <span className="opacity-75">· {member.group.name}</span>}
            </div>
            {member.status !== "ACTIVE" && <div className="mt-1.5 text-xs font-semibold opacity-80">Statut : {member.status === "INACTIVE" ? "Inactif" : member.status === "SUSPENDED" ? "Suspendu" : "Ancien membre"}</div>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 pb-2 pt-3.5">
        {canEdit && (
          <Link href={`/membres/${id}/modifier`} className="gph-btn-ghost flex-1">
            <Pencil size={15} /> Modifier
          </Link>
        )}
        {can(user, "member.delete") && <DeleteMemberButton id={id} name={name} />}
        <details className="relative">
          <summary className="gph-btn-primary aspect-square list-none p-2.5 [&::-webkit-details-marker]:hidden" aria-label="Contacter">
            <MessageCircle size={16} strokeWidth={2.5} />
          </summary>
          <div className="gph-card absolute right-0 top-12 z-10 flex max-h-[70vh] w-64 flex-col overflow-y-auto py-1 text-sm font-semibold">
            {contacts.length === 0 && <span className="px-4 py-3 font-medium text-ink-3">Aucun contact renseigné</span>}
            {contacts.map((c) => (
              <div key={c.label} className="border-b border-divider py-1 last:border-none">
                {contacts.length > 1 && <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">{c.label}</div>}
                <ContactLinks c={c} />
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="px-4 pb-4 pt-2 lg:grid lg:grid-cols-2 lg:gap-x-4">
        <div>
          {/* Groupe sanguin — information d'urgence mise en évidence */}
          {member.bloodGroup && (
            <div className="gph-card mb-3.5 flex items-center gap-3 border-l-4 p-3" style={{ borderLeftColor: "var(--gph-danger)" }}>
              <Droplet size={18} className="text-danger" fill="currentColor" />
              <div className="flex-1 text-[13px] font-semibold text-ink-2">Groupe sanguin</div>
              <span className="text-lg font-bold text-danger">{member.bloodGroup}</span>
            </div>
          )}
          {member.medicalInfo && (
            <div className="gph-card mb-3.5 flex items-start gap-3 p-3">
              <HeartPulse size={18} className="mt-0.5 flex-none text-danger" />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">Informations médicales · accès restreint</div>
                <div className="mt-0.5 whitespace-pre-line text-sm font-medium">{member.medicalInfo}</div>
              </div>
            </div>
          )}

          {/* Infos */}
          <div className="gph-card mb-3.5 py-1">
            {infoRows.map((row) => (
              <div key={row.label} className="flex items-center gap-3.5 border-b border-divider px-3.5 py-3">
                <IconBox><row.icon size={16} className="text-primary" /></IconBox>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">{row.label}</div>
                  <div className="mt-px truncate text-sm font-semibold">{row.val}</div>
                </div>
              </div>
            ))}
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3.5 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
                <IconBox><QrCode size={16} className="text-primary" /></IconBox>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">Code QR</div>
                  <div className="mt-px font-mono text-sm font-semibold">{member.matricule}</div>
                </div>
                <Eye size={16} className="text-ink-3" />
              </summary>
              <div className="flex flex-col items-center gap-3 px-3.5 pb-4">
                <div className="w-full max-w-[280px] rounded-xl bg-white p-2 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                <div className="grid w-full grid-cols-2 gap-2">
                  <a href={qrPng} download={`QR-${member.matricule}.png`} className="gph-btn-ghost"><Download size={15} /> PNG</a>
                  <a href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`} download={`QR-${member.matricule}.svg`} className="gph-btn-ghost">
                    <Download size={15} /> SVG
                  </a>
                  <Link href={`/membres/${id}/qr`} className="gph-btn-ghost"><Printer size={15} /> Grand / imprimer</Link>
                  <ShareQrButton pngDataUrl={qrPng} filename={`QR-${member.matricule}.png`} title={`QR code — ${name}`} />
                </div>
                {canEdit && <RegenerateQrButton id={id} />}
              </div>
            </details>
          </div>

          {/* Tuteurs (US-2.2) */}
          {(member.parents.length > 0 || minor) && (
            <>
              <SectionTitle>Tuteurs</SectionTitle>
              <div className="gph-card mb-3.5 py-1">
                {member.parents.length === 0 && (
                  <div className="p-3.5 text-sm font-medium text-danger">Aucun tuteur : obligatoire pour un mineur.</div>
                )}
                {member.parents.map((l) => (
                  <div key={l.parentId} className="flex items-center gap-3 border-b border-divider px-3.5 py-3 last:border-none">
                    <IconBox><Users size={16} className="text-primary" /></IconBox>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">
                        Tuteur {l.rank} · {RELATIONSHIPS[l.relationship as Relationship] ?? l.relationship}{l.rank === 1 && " · contact principal"}
                      </div>
                      <div className="truncate text-sm font-semibold">{l.parent.firstName} {l.parent.lastName}</div>
                      <div className="text-xs font-medium text-ink-3">{formatPhone(l.parent.phone)}</div>
                    </div>
                    <a href={`tel:${l.parent.phone}`} className="gph-btn-primary aspect-square p-2.5" aria-label={`Appeler ${l.parent.firstName}`}>
                      <Phone size={16} />
                    </a>
                    {canEdit && !l.parent.user?.lastLoginAt && <div className="w-24"><InviteParentButton parentId={l.parentId} /></div>}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Taekwondo : grade, catégories */}
          <SectionTitle>Taekwondo</SectionTitle>
          <div className="gph-card mb-3.5 p-3.5">
            {current ? (
              <div className="flex items-center gap-3">
                <BeltBadge grade={current.grade} width={56} height={16} title={current.grade.beltLabel} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{current.grade.beltLabel}</div>
                  <div className="text-xs font-medium text-ink-3">
                    {gradeShortLabel(current.grade)} · grille {current.grade.grid.name} · depuis le {formatDate(current.date)}
                  </div>
                </div>
                {elig && (
                  <span className={`gph-badge ${elig.eligible ? "success" : "neutral"}`}>
                    {elig.eligible ? <><Check size={11} strokeWidth={3} /> Éligible</> : elig.reasons[0]}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-sm font-medium text-ink-3">Aucun grade enregistré.</div>
            )}
            {profile && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-divider pt-3 text-xs font-semibold">
                <span className="gph-badge primary">{profile.ageCategory ?? "Hors catégorie"}</span>
                {profile.weightCategory && <span className="gph-badge neutral">{profile.weightCategory}</span>}
                {member.weighIns[0] && (
                  <span className="gph-badge neutral"><Scale size={11} /> {String(member.weighIns[0].weightKg).replace(".", ",")} kg · {formatDate(member.weighIns[0].date)}</span>
                )}
                {profile.nearLimit && <span className="gph-badge warning">Poids proche d&apos;une limite</span>}
                {member.weighIns[0] && profile.staleWeighIn && <span className="gph-badge warning">Pesée de plus de {association.weighInMaxDays} jours</span>}
              </div>
            )}
            {(member.licenseNo || member.kukkiwonNo) && (
              <div className="mt-2 text-xs font-medium text-ink-3">
                {member.licenseNo && <>Licence <span className="font-mono">{member.licenseNo}</span></>}
                {member.licenseNo && member.kukkiwonNo && " · "}
                {member.kukkiwonNo && <>Kukkiwon <span className="font-mono">{member.kukkiwonNo}</span></>}
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href={`/grades/athletes/${id}`} className="gph-btn-ghost"><Award size={15} /> Grades</Link>
              <Link href={`/palmares/athletes/${id}`} className="gph-btn-ghost"><Trophy size={15} /> Palmarès</Link>
            </div>
          </div>
        </div>

        <div>
          {/* Présence générale */}
          <SectionTitle link={{ href: `/membres/${id}/presences`, label: "Voir tout" }}>Présence</SectionTitle>
          <div className="gph-card mb-3.5 p-3.5">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-[13px] font-semibold">Présence générale</span>
              <span className="text-xs font-bold" style={{ color: presentCount >= history.length / 2 ? "var(--gph-success)" : "var(--gph-danger)" }}>
                {history.length ? `${presentCount} sur ${history.length}` : "Aucune séance"}
              </span>
            </div>
            {history.length > 0 && (
              <>
                <div className="flex gap-1.5">
                  {chrono.map((h) => (
                    <div key={h.id} title={`${h.title} · ${formatDate(h.date)} · ${h.status === "PRESENT" ? "Présent" : h.status === "EXCUSED" ? "Excusé" : "Absent"}`}
                      className="h-8 flex-1 rounded-md"
                      style={h.status === "PRESENT" ? { background: "var(--gph-success)" }
                        : h.status === "EXCUSED" ? { background: "var(--gph-track)" }
                        : { background: "var(--gph-danger-soft)", border: "1px solid var(--gph-danger)" }} />
                  ))}
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-ink-3">
                  <span>{formatDate(chrono[0].date)}</span>
                  <span>{formatDate(chrono[chrono.length - 1].date)}</span>
                </div>
              </>
            )}
            <div className="mt-3 text-xs font-medium text-ink-3">
              Année {schoolYear} : {att.sessionRate.present}/{att.sessionRate.total} séances ({att.sessionRate.pct} %)
              {att.events.length > 0 && ` · ${att.eventRate.present}/${att.eventRate.total} événements`}
            </div>
          </div>

          {/* Cotisations */}
          {showFees && (
            <>
              <SectionTitle link={{ href: "/cotisations", label: "Détail" }}>Cotisations {schoolYear.replace("-", "‑")}</SectionTitle>
              <div className="gph-card mb-3.5 p-3.5">
                {(["DROIT", "PASSPORT"] as const).map((code) => {
                  const due = annual(code);
                  const meta = FEE_META[code];
                  const st = DUE_STATUS_META[(due?.status ?? "UNPAID") as DueStatus];
                  return (
                    <div key={code} className="mb-3 flex items-center gap-3 border-b border-divider pb-3">
                      <IconBox bg={meta.soft} color={meta.color}><Icon name={meta.icon} size={16} /></IconBox>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold">{code === "DROIT" ? "Droit" : "Passport"}</div>
                        <div className="gph-amount mt-px text-[11px] font-medium text-ink-3">
                          {due ? `${formatAriary(due.amountDue)} / an` : "Tarif non défini"}
                        </div>
                      </div>
                      {due && (
                        <span className={`gph-badge ${st.tone}`}>
                          <Icon name={st.icon} size={11} strokeWidth={3} /> {st.label}
                        </span>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center gap-3">
                  <IconBox bg="var(--gph-ecolage-soft)" color="var(--gph-ecolage)"><Icon name="graduation-cap" size={16} /></IconBox>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <div className="text-[13px] font-semibold">Écolage</div>
                      <div className="gph-amount text-[11px] font-semibold text-ink-3">{ecolagePaid} / 12 mois</div>
                    </div>
                    <div className="flex gap-[3px]">
                      {schoolMonths(association.schoolYearStartMon).map((month) => {
                        const st = ecolage.get(month)?.status;
                        return (
                          <div key={month} title={MONTH_INITIALS[month - 1]} className="h-[18px] flex-1 rounded"
                            style={st === "PAID" ? { background: "var(--gph-success)" }
                              : st === "PARTIAL" ? { background: "var(--gph-warning)" }
                              : st === "UNPAID" ? { background: "var(--gph-danger-soft)", border: "1px solid var(--gph-danger)" }
                              : { background: "var(--gph-divider)" }} />
                        );
                      })}
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] font-semibold text-ink-3">
                      <span>S</span>
                      <span>A</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Historique */}
          <SectionTitle link={{ href: `/membres/${id}/presences`, label: "Voir tout" }}>Historique</SectionTitle>
          {history.length === 0 ? (
            <div className="gph-card mb-3.5 p-5 text-center text-sm text-ink-3">Aucune séance enregistrée.</div>
          ) : (
            <ul className="mb-3.5 flex flex-col gap-2">
              {history.slice(0, 4).map((h) => {
                const present = h.status === "PRESENT";
                return (
                  <li key={h.id}>
                    <Link href={`/presence/${h.id}`} className="gph-card flex items-center gap-3 p-3">
                      <IconBox bg={present ? "var(--gph-success-soft)" : "var(--gph-danger-soft)"}>
                        {present ? <Check size={16} strokeWidth={2.5} color="#047857" /> : <X size={16} strokeWidth={2.5} color="#B91C1C" />}
                      </IconBox>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{h.title}</div>
                        <div className="text-xs font-medium text-ink-3">{formatDate(h.date)}</div>
                      </div>
                      <span className={`gph-badge ${present ? "success" : h.status === "EXCUSED" ? "neutral" : "danger"}`}>
                        {present ? "Présent" : h.status === "EXCUSED" ? "Excusé" : "Absent"}
                      </span>
                      <ChevronRight size={16} className="text-ink-3" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Comptes et suppression */}
          {(canEdit || can(user, "member.hardDelete")) && (
            <div className="flex flex-col gap-3">
              {canEdit && age >= 18 && !member.user && <CreateAccountButton memberId={id} />}
              {member.user && <p className="text-center text-xs font-medium text-ink-3">Le membre dispose d&apos;un compte athlète.</p>}
              {can(user, "member.hardDelete") && <div className="text-center"><HardDeleteButton id={id} name={name} /></div>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ContactLinks({ c }: { c: Contact }) {
  const digits = c.phone?.replace(/\D/g, "");
  const fbHref = c.facebook && (/^https?:\/\//.test(c.facebook) ? c.facebook : `https://facebook.com/${encodeURIComponent(c.facebook)}`);
  return (
    <>
      {c.phone && (
        <>
          <a href={`tel:${c.phone}`} className="flex items-center gap-2.5 px-4 py-2.5"><Phone size={16} /> Appeler</a>
          <a href={`sms:${c.phone}`} className="flex items-center gap-2.5 px-4 py-2.5"><MessageSquare size={16} /> SMS</a>
          <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-4 py-2.5"><MessageCircle size={16} /> WhatsApp</a>
        </>
      )}
      {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2.5 px-4 py-2.5"><Mail size={16} /> Email</a>}
      {fbHref && <a href={fbHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-4 py-2.5"><Globe size={16} /> Facebook</a>}
    </>
  );
}

function IconBox({ children, bg = "var(--gph-primary-soft)", color }: { children: React.ReactNode; bg?: string; color?: string }) {
  return (
    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: bg, color }}>
      {children}
    </div>
  );
}
