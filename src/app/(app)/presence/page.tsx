import { CalendarDays, Calendar, Plus, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterChips, ProgressBar, ScreenHeader, SectionTitle } from "@/components/ui";
import { sessionStats, expectedMembersWhere } from "@/lib/attendance";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { pctTone } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { PresenceTabs } from "./presence-tabs";

export const metadata: Metadata = { title: "Présence" };

const PERIODS = [
  { value: "mois", label: "Ce mois" },
  { value: "precedent", label: "Mois précédent" },
  { value: "annee", label: "Année scolaire" },
];

function periodRange(period: string, startMonth: number): [Date, Date] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === "precedent") return [new Date(y, m - 1, 1), new Date(y, m, 1)];
  if (period === "annee") {
    const startYear = m + 1 >= startMonth ? y : y - 1;
    return [new Date(startYear, startMonth - 1, 1), new Date(startYear + 1, startMonth - 1, 1)];
  }
  return [new Date(y, m, 1), new Date(y, m + 1, 1)];
}

export default async function PresencePage(props: PageProps<"/presence">) {
  const user = await requirePermission("attendance.viewAll");
  const association = await getAssociation();
  const sp = await props.searchParams;
  const period = PERIODS.some((p) => p.value === sp.periode) ? String(sp.periode) : "mois";
  const [from, to] = periodRange(period, association.schoolYearStartMon);

  const [sessions, memberCount] = await Promise.all([
    db.session.findMany({
      where: { date: { gte: from, lt: to } },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      include: { group: { select: { name: true } } },
    }),
    db.member.count({ where: expectedMembersWhere(null) }),
  ]);
  const stats = await sessionStats(sessions);
  const avg = sessions.length
    ? Math.round([...stats.values()].reduce((sum, s) => sum + s.pct, 0) / sessions.length)
    : 0;
  const tone = (p: number) => pctTone(p, association.thresholdGreen, association.thresholdOrange);
  const periodLabel = PERIODS.find((p) => p.value === period)!.label.toLowerCase();

  return (
    <>
      <ScreenHeader
        title="Présence"
        sub={`${sessions.length} séance${sessions.length > 1 ? "s" : ""} · ${periodLabel}`}
        action={
          can(user, "session.manage") && (
            <Link href="/presence/nouvelle" className="gph-btn-primary">
              <Plus size={16} strokeWidth={2.5} />
              Nouvelle session
            </Link>
          )
        }
      />

      <div className="px-4">
        <PresenceTabs active="seances" />
        <div className="mb-3">
          <FilterChips options={PERIODS} active={period} hrefFor={(v) => `/presence?periode=${v}`} />
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2.5">
          {[
            { label: "Sessions", val: sessions.length, Icon: CalendarDays },
            { label: "Présence moy.", val: `${avg}%`, Icon: TrendingUp },
            { label: "Membres", val: memberCount, Icon: Users },
          ].map(({ label, val, Icon }) => (
            <div key={label} className="gph-card px-3 pb-2.5 pt-3">
              <Icon size={16} className="text-primary" />
              <div className="mt-1.5 text-xl font-bold tracking-[-0.02em]">{val}</div>
              <div className="mt-0.5 text-[11px] font-semibold text-ink-3">{label}</div>
            </div>
          ))}
        </div>

        <SectionTitle>Sessions récentes</SectionTitle>

        {sessions.length === 0 ? (
          <div className="gph-card p-6 text-center text-sm text-ink-3">Aucune séance sur cette période.</div>
        ) : (
          <div className="grid gap-2.5 lg:grid-cols-2">
            {sessions.map((s) => {
              const st = stats.get(s.id)!;
              return (
                <Link key={s.id} href={`/presence/${s.id}`} className="gph-card block p-3.5">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-3">
                        <Calendar size={12} />
                        {formatDate(s.date)}
                        {s.startTime && ` · ${s.startTime.replace(":", "h")}`}
                        {s.group && ` · ${s.group.name}`}
                        {s.status === "CLOSED" && " · clôturée"}
                      </div>
                      <div className="text-base font-bold">{s.title}</div>
                    </div>
                    <span className={`gph-badge ${tone(st.pct)}`}>{st.pct}%</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2.5">
                    <ProgressBar pct={st.pct} tone={tone(st.pct)} />
                    <div className="min-w-[42px] text-right text-[13px] font-bold text-ink-2">
                      {st.present}
                      <span className="font-semibold text-ink-3">/{st.total}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
