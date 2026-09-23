import {
  CalendarDays, Check, ChevronLeft, Droplet, Download, Eye, Globe, Mail, MessageCircle, MessageSquare,
  Pencil, Phone, QrCode, UserRound, X,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icon";
import { DeleteMemberButton, RegenerateQrButton } from "@/components/member-actions";
import { SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { DUE_STATUS_META, FEE_META, fullName, POSITIONS, SEXES, type DueStatus, type Position } from "@/lib/domain";
import { ensureDues } from "@/lib/fees";
import { formatAriary, formatDate, formatPhone, schoolMonths } from "@/lib/format";
import { can } from "@/lib/permissions";
import { qrPayload } from "@/lib/qr";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requirePermission("attendance.viewAll"); // pas de fuite du nom dans <title>
  const m = await db.member.findUnique({ where: { id: (await params).id }, select: { firstName: true, lastName: true } });
  return { title: m ? fullName(m) : "Membre" };
}

function age(birth: Date) {
  const now = new Date();
  let a = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) a--;
  return a;
}

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export default async function MemberPage({ params }: Props) {
  const user = await requirePermission("attendance.viewAll");
  const { id } = await params;
  const member = await db.member.findUnique({ where: { id }, include: { group: true } });
  if (!member || member.archived) notFound();

  const association = await getAssociation();
  const schoolYear = association.currentSchoolYear;
  const showFees = can(user.profile, "payment.viewAll");
  if (showFees) await ensureDues(schoolYear);

  // Séances passées concernant ce membre (tous les membres ou son groupe), avec son statut.
  const sessions = await db.session.findMany({
    where: { date: { lte: new Date() }, OR: [{ groupId: null }, ...(member.groupId ? [{ groupId: member.groupId }] : [])] },
    orderBy: { date: "desc" },
    take: 5,
    select: { id: true, title: true, date: true, attendances: { where: { memberId: id }, select: { status: true, scannedAt: true } } },
  });
  const history = sessions.map((s) => ({ ...s, present: s.attendances[0]?.status === "PRESENT" }));
  const chrono = [...history].reverse();
  const presentCount = history.filter((h) => h.present).length;

  const dues = showFees
    ? await db.due.findMany({ where: { memberId: id, schoolYear }, include: { feeType: true } })
    : [];
  const annual = (code: "DROIT" | "PASSPORT") => dues.find((d) => d.feeType.code === code);
  const ecolage = new Map(dues.filter((d) => d.feeType.code === "ECOLAGE").map((d) => [d.month, d]));
  const ecolagePaid = [...ecolage.values()].filter((d) => d.status === "PAID").length;

  const name = fullName(member);
  const qrSvg = await QRCode.toString(qrPayload(member.qrToken), { type: "svg", margin: 1, width: 220, color: { dark: "#1A1A2E" } });
  const phoneDigits = member.phone?.replace(/\D/g, "");
  const fbHref = member.facebook && (/^https?:\/\//.test(member.facebook) ? member.facebook : `https://facebook.com/${encodeURIComponent(member.facebook)}`);
  const canEdit = can(user.profile, "member.edit");

  const infoRows = [
    { icon: Phone, label: "Téléphone", val: member.phone ? formatPhone(member.phone) : "—" },
    { icon: Mail, label: "Email", val: member.email ?? "—" },
    { icon: CalendarDays, label: "Inscription", val: formatDate(member.joinedAt) },
    { icon: UserRound, label: "Naissance", val: `${formatDate(member.birthDate)} · ${age(member.birthDate)} ans · ${SEXES[member.sex as "M" | "F"] ?? member.sex}${member.birthPlace ? ` · ${member.birthPlace}` : ""}` },
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
        {can(user.profile, "member.delete") && <DeleteMemberButton id={id} name={name} />}
        <details className="relative">
          <summary className="gph-btn-primary aspect-square list-none p-2.5 [&::-webkit-details-marker]:hidden" aria-label="Contacter">
            <MessageCircle size={16} strokeWidth={2.5} />
          </summary>
          <div className="gph-card absolute right-0 top-12 z-10 flex w-52 flex-col py-1 text-sm font-semibold">
            {member.phone && (
              <>
                <a href={`tel:${member.phone}`} className="flex items-center gap-2.5 px-4 py-3"><Phone size={16} /> Appeler</a>
                <a href={`sms:${member.phone}`} className="flex items-center gap-2.5 px-4 py-3"><MessageSquare size={16} /> SMS</a>
                <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-4 py-3"><MessageCircle size={16} /> WhatsApp</a>
              </>
            )}
            {member.email && <a href={`mailto:${member.email}`} className="flex items-center gap-2.5 px-4 py-3"><Mail size={16} /> Email</a>}
            {fbHref && <a href={fbHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-4 py-3"><Globe size={16} /> Facebook</a>}
            {!member.phone && !member.email && !fbHref && <span className="px-4 py-3 font-medium text-ink-3">Aucun contact renseigné</span>}
          </div>
        </details>
      </div>

      <div className="px-4 pb-4 pt-2">
        {/* Groupe sanguin — information d'urgence mise en évidence */}
        {member.bloodGroup && (
          <div className="gph-card mb-3.5 flex items-center gap-3 border-l-4 p-3" style={{ borderLeftColor: "var(--gph-danger)" }}>
            <Droplet size={18} className="text-danger" fill="currentColor" />
            <div className="flex-1 text-[13px] font-semibold text-ink-2">Groupe sanguin</div>
            <span className="text-lg font-bold text-danger">{member.bloodGroup}</span>
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
              <div className="rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <div className="flex w-full gap-2">
                <a href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`} download={`QR-${member.matricule}.svg`} className="gph-btn-ghost flex-1">
                  <Download size={15} /> Télécharger
                </a>
                {canEdit && <RegenerateQrButton id={id} />}
              </div>
            </div>
          </details>
        </div>

        {/* Présence générale */}
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
                  <div
                    key={h.id}
                    title={`${h.title} · ${formatDate(h.date)} · ${h.present ? "Présent" : "Absent"}`}
                    className="h-8 flex-1 rounded-md"
                    style={h.present ? { background: "var(--gph-success)" } : { background: "var(--gph-danger-soft)", border: "1px solid var(--gph-danger)" }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-ink-3">
                <span>{formatDate(chrono[0].date)}</span>
                <span>{formatDate(chrono[chrono.length - 1].date)}</span>
              </div>
            </>
          )}
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
                    {schoolMonths().map((month) => {
                      const st = ecolage.get(month)?.status;
                      return (
                        <div
                          key={month}
                          title={MONTH_INITIALS[month - 1]}
                          className="h-[18px] flex-1 rounded"
                          style={
                            st === "PAID" ? { background: "var(--gph-success)" }
                            : st === "PARTIAL" ? { background: "var(--gph-warning)" }
                            : st === "UNPAID" ? { background: "var(--gph-danger-soft)", border: "1px solid var(--gph-danger)" }
                            : { background: "var(--gph-divider)" }
                          }
                        />
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
        <SectionTitle>Historique</SectionTitle>
        {history.length === 0 ? (
          <div className="gph-card p-5 text-center text-sm text-ink-3">Aucune séance enregistrée.</div>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.slice(0, 4).map((h) => (
              <li key={h.id}>
                <Link href={`/presence/${h.id}`} className="gph-card flex items-center gap-3 p-3">
                  <IconBox bg={h.present ? "var(--gph-success-soft)" : "var(--gph-danger-soft)"}>
                    {h.present ? <Check size={16} strokeWidth={2.5} color="#047857" /> : <X size={16} strokeWidth={2.5} color="#B91C1C" />}
                  </IconBox>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{h.title}</div>
                    <div className="text-xs font-medium text-ink-3">{formatDate(h.date)}</div>
                  </div>
                  <span className={`gph-badge ${h.present ? "success" : "danger"}`}>{h.present ? "Présent" : "Absent"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
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
