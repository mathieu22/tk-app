import { Calendar, Download, FileSpreadsheet, FileText, Lock, MapPin, Repeat, ScanLine, Share2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { BackButton, FilterChips, ProgressBar, StatTile } from "@/components/ui";
import { expectedMembersWhere, sessionStats } from "@/lib/attendance";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { fullName, pctTone, POSITIONS, type Position } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { AttendanceMenu, CloseSessionButton, DeleteSessionButton } from "./controls";

export const metadata: Metadata = { title: "Détail de session" };

const FILTERS = ["tous", "presents", "absents"] as const;

export default async function SessionDetailPage(props: PageProps<"/presence/[id]">) {
  const user = await requirePermission("attendance.viewAll");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const filter = FILTERS.find((f) => f === sp.filtre) ?? "tous";

  const session = await db.session.findUnique({ where: { id }, include: { group: true } });
  if (!session) notFound();
  const association = await getAssociation();

  const [expected, attendances] = await Promise.all([
    db.member.findMany({ where: expectedMembersWhere(session.groupId), orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.attendance.findMany({ where: { sessionId: id }, include: { member: true } }),
  ]);
  const byMember = new Map(attendances.map((a) => [a.memberId, a]));
  // Attendus + présents hors groupe ajoutés sur confirmation
  const extra = attendances.filter((a) => !expected.some((m) => m.id === a.memberId)).map((a) => a.member);
  const rows = [...expected, ...extra].map((m) => {
    const a = byMember.get(m.id);
    return { m, status: (a?.status ?? "ABSENT") as "PRESENT" | "ABSENT" | "EXCUSED", at: a?.scannedAt ?? null };
  });

  const st = (await sessionStats([session])).get(session.id)!;
  const absents = rows.filter((r) => r.status === "ABSENT").length;
  const tone = pctTone(st.pct, association.thresholdGreen, association.thresholdOrange);
  const shown = rows.filter((r) =>
    filter === "presents" ? r.status === "PRESENT" : filter === "absents" ? r.status !== "PRESENT" : true,
  );
  const manage = can(user, "session.manage");
  const canDelete = user.profile === "ADMIN" || user.profile === "PRESIDENT";
  const open = session.status === "OPEN";

  const shareText = encodeURIComponent(
    `${session.title} — ${formatDate(session.date)}${session.startTime ? ` à ${session.startTime.replace(":", "h")}` : ""}` +
      `${session.location ? `, ${session.location}` : ""}. Présents : ${st.present}/${st.total} (${st.pct} %).`,
  );

  return (
    <>
      <div className="flex items-center justify-between px-4 pb-2 pt-1.5">
        <BackButton href="/presence" />
        <div className="flex gap-2">
          <details className="relative">
            <summary className="gph-icon-btn cursor-pointer list-none" aria-label="Exporter">
              <Download size={16} />
            </summary>
            <div className="gph-card absolute right-0 top-10 z-10 flex w-44 flex-col p-1">
              <a href={`/api/sessions/${session.id}/export?format=xlsx`} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-bg">
                <FileSpreadsheet size={15} /> Excel
              </a>
              <a href={`/api/sessions/${session.id}/export?format=pdf`} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-bg">
                <FileText size={15} /> PDF
              </a>
            </div>
          </details>
          <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noopener noreferrer" className="gph-icon-btn" aria-label="Partager">
            <Share2 size={16} />
          </a>
          {manage && <CloseSessionButton sessionId={session.id} open={open} />}
          {canDelete && <DeleteSessionButton sessionId={session.id} hasSeries={!!session.seriesId} />}
        </div>
      </div>

      <div className="px-5 pb-3 pt-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-3">
          <Calendar size={12} />
          {formatDate(session.date)}
          {session.startTime && ` · ${session.startTime.replace(":", "h")}`}
          {session.location && (
            <>
              <span className="h-[3px] w-[3px] rounded-full bg-ink-3" />
              <MapPin size={12} />
              {session.location}
            </>
          )}
          {session.seriesId && (
            <span className="gph-badge primary ml-1"><Repeat size={11} /> Récurrente</span>
          )}
          {!open && (
            <span className="gph-badge neutral ml-1"><Lock size={11} /> Clôturée</span>
          )}
        </div>
        <h1 className="m-0 text-[26px] font-bold tracking-[-0.02em]">{session.title}</h1>
        {session.group && <div className="mt-0.5 text-[13px] font-medium text-ink-3">Groupe {session.group.name}</div>}
      </div>

      <div className="px-4">
        <div className="mb-3.5 grid grid-cols-3 gap-2">
          <StatTile value={st.present} label="Présents" color="var(--gph-success)" />
          <StatTile value={absents} label="Absents" color="var(--gph-danger)" />
          <StatTile value={st.total} label={st.excused ? `Total (${st.excused} exc.)` : "Total"} color="var(--gph-ink-2)" />
        </div>

        <div className="gph-card mb-3.5 p-3.5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-ink-2">Taux de présence</span>
            <span className={`gph-badge ${tone} text-base`}>{st.pct}%</span>
          </div>
          <ProgressBar pct={st.pct} height={8} color="linear-gradient(90deg, var(--gph-primary) 0%, var(--gph-accent) 100%)" />
        </div>

        {manage && open && (
          <Link href={`/presence/${session.id}/scanner`} className="gph-btn-primary full mb-3.5">
            <ScanLine size={18} strokeWidth={2.5} />
            Scanner les présences
          </Link>
        )}

        <div className="mb-3">
          <FilterChips
            active={filter}
            hrefFor={(f) => `/presence/${session.id}?filtre=${f}`}
            options={[
              { value: "tous", label: "Tous", count: rows.length },
              { value: "presents", label: "Présents", count: st.present },
              { value: "absents", label: "Absents", count: rows.length - st.present },
            ]}
          />
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          {shown.map(({ m, status, at }) => (
            <div key={m.id} className="gph-card flex items-center gap-3 p-2.5">
              <Avatar name={fullName(m)} size={40} photoUrl={m.photoUrl} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{fullName(m)}</div>
                <div className="text-xs font-medium text-ink-3">
                  {POSITIONS[m.position as Position] ?? m.position}
                  {status === "PRESENT" && at && ` · ${at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                </div>
              </div>
              <span className={`gph-badge ${status === "PRESENT" ? "success" : status === "EXCUSED" ? "neutral" : "danger"}`}>
                <span className="gph-dot" style={{ background: "currentColor" }} />
                {status === "PRESENT" ? "Présent" : status === "EXCUSED" ? "Excusé" : "Absent"}
              </span>
              {manage && <AttendanceMenu sessionId={session.id} memberId={m.id} status={status} />}
            </div>
          ))}
          {shown.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3">Aucun membre.</div>}
        </div>
      </div>
    </>
  );
}
