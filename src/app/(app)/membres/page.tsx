import { Check, ChevronRight, Clock, Download, Phone, Search, Upload, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { Avatar } from "@/components/avatar";
import { BeltBadge } from "@/components/belt-badge";
import { FilterChips, ScreenHeader } from "@/components/ui";
import { competitionProfile, getSeason } from "@/lib/categories";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { BOARD_POSITIONS, fullName, MEMBER_STATUSES, POSITIONS, SEXES, type Position } from "@/lib/domain";
import { ensureDues } from "@/lib/fees";
import { formatPhone, normalizePhone } from "@/lib/format";
import { currentGrades, gradeShortLabel } from "@/lib/grades";
import { can } from "@/lib/permissions";
import { feesUpToDate } from "./_lib";

export const metadata: Metadata = { title: "Membres" };

const ROLES = ["tous", "bureau", "membres", "nouveaux"] as const;
type Role = (typeof ROLES)[number];

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 3600 * 1000);

export default async function MembersPage({ searchParams }: PageProps<"/membres">) {
  const user = await requirePermission("member.view");
  const association = await getAssociation();
  const sp = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const q = sp.q?.trim() ?? "";
  const role: Role = ROLES.includes(sp.role as Role) ? (sp.role as Role) : "tous";
  const status = sp.statut && sp.statut in MEMBER_STATUSES ? sp.statut : "ACTIVE";
  const sex = sp.sexe === "M" || sp.sexe === "F" ? sp.sexe : "";
  const showFees = can(user, "payment.viewAll");

  const newSince = daysAgo(association.newMemberDays);
  const roleWhere: Record<Role, Prisma.MemberWhereInput> = {
    tous: {},
    bureau: { position: { in: BOARD_POSITIONS } },
    membres: { position: { notIn: BOARD_POSITIONS } },
    nouveaux: { joinedAt: { gte: newSince } },
  };

  const phoneQuery = q ? normalizePhone(q) ?? q.replace(/\s/g, "") : "";
  const base: Prisma.MemberWhereInput = {
    archived: false,
    status,
    ...(sex && { sex }),
    ...(q && {
      OR: [
        { lastName: { contains: q.toUpperCase() } },
        { firstName: { contains: q } },
        { firstName: { contains: q.charAt(0).toUpperCase() + q.slice(1).toLowerCase() } },
        { phone: { contains: phoneQuery.replace(/^0/, "") } },
      ],
    }),
  };

  const [rows, season, ...counts] = await Promise.all([
    db.member.findMany({
      where: { ...base, ...roleWhere[role] },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true, firstName: true, lastName: true, position: true, phone: true, photoUrl: true, birthDate: true, sex: true,
        group: { select: { name: true } },
        weighIns: { orderBy: { date: "desc" }, take: 1, select: { weightKg: true, date: true } },
      },
    }),
    getSeason(),
    ...ROLES.map((r) => db.member.count({ where: { ...base, ...roleWhere[r] } })),
  ]);

  // Catégories fédérales (US-5.5) : calculées, donc filtrées après la requête.
  const profiled = rows.map((m) => ({
    ...m,
    profile: season ? competitionProfile(season, m, m.weighIns[0] ?? null, { alertKg: association.weightAlertKg, maxDays: association.weighInMaxDays }) : null,
  }));
  const ageCats = season?.ageCategories.map((c) => c.name) ?? [];
  const cat = ageCats.includes(sp.cat ?? "") ? sp.cat! : "";
  const weightOptions = cat && season
    ? [...new Set(season.ageCategories.find((c) => c.name === cat)!.weights.filter((w) => !sex || w.sex === sex).map((w) => w.label))]
    : [];
  const weight = weightOptions.includes(sp.poids ?? "") ? sp.poids! : "";
  const members = profiled.filter((m) => (!cat || m.profile?.ageCategory === cat) && (!weight || m.profile?.weightCategory === weight));

  const ids = members.map((m) => m.id);
  if (showFees) await ensureDues(association.currentSchoolYear);
  const [grades, upToDate] = await Promise.all([
    currentGrades(ids),
    showFees ? feesUpToDate(ids, association.currentSchoolYear, association.schoolYearStartMon) : Promise.resolve(null),
  ]);
  const activeCount = await db.member.count({ where: { archived: false, status: "ACTIVE" } });

  const current = { q, role, statut: status, sexe: sex, cat, poids: weight };
  const href = (params: Partial<typeof current>) => {
    const merged = { ...current, ...params };
    if (params.cat !== undefined || params.sexe !== undefined) merged.poids = params.poids ?? "";
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (!v || (k === "role" && v === "tous") || (k === "statut" && v === "ACTIVE")) continue;
      next.set(k, v);
    }
    const s = next.toString();
    return s ? `/membres?${s}` : "/membres";
  };
  const small = (active: boolean) => `flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? "bg-primary-soft text-primary" : "text-ink-3"}`;

  return (
    <>
      <ScreenHeader
        title="Membres"
        sub={`${activeCount} membre${activeCount > 1 ? "s" : ""} actif${activeCount > 1 ? "s" : ""}`}
        action={
          <div className="flex gap-2">
            {can(user, "member.import") && (
              <>
                <Link href="/membres/import" className="gph-btn-ghost hidden sm:inline-flex" title="Importer"><Upload size={16} /> Importer</Link>
                <a href="/api/membres/export" className="gph-btn-ghost hidden sm:inline-flex" title="Exporter"><Download size={16} /> Exporter</a>
              </>
            )}
            {can(user, "member.edit") && (
              <Link href="/membres/nouveau" className="gph-btn-primary">
                <UserPlus size={16} strokeWidth={2.5} />
                Ajouter
              </Link>
            )}
          </div>
        }
      />

      <form action="/membres" className="px-4 pb-3 pt-1" role="search">
        {Object.entries(current).filter(([k, v]) => k !== "q" && v && !(k === "role" && v === "tous") && !(k === "statut" && v === "ACTIVE"))
          .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input name="q" type="search" defaultValue={q} placeholder="Rechercher un membre" aria-label="Rechercher un membre" className="gph-input with-icon" />
        </div>
      </form>

      <div className="px-4 pb-2">
        <FilterChips
          active={role}
          hrefFor={(v) => href({ role: v as Role })}
          options={[
            { value: "tous", label: "Tous", count: counts[0] },
            { value: "bureau", label: "Bureau", count: counts[1] },
            { value: "membres", label: "Membres", count: counts[2] },
            { value: "nouveaux", label: "Nouveaux", count: counts[3] },
          ]}
        />
      </div>
      <div className="flex flex-col gap-1 px-4 pb-3">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {Object.entries(MEMBER_STATUSES).map(([value, label]) => (
            <Link key={value} href={href({ statut: value })} scroll={false} replace className={small(value === status)}>{label}</Link>
          ))}
          <span className="mx-1 w-px flex-none bg-divider" />
          {Object.entries(SEXES).map(([value, label]) => (
            <Link key={value} href={href({ sexe: sex === value ? "" : value })} scroll={false} replace className={small(sex === value)}>{label}</Link>
          ))}
        </div>
        {ageCats.length > 0 && (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {ageCats.map((c) => (
              <Link key={c} href={href({ cat: cat === c ? "" : c })} scroll={false} replace className={small(cat === c)}>{c}</Link>
            ))}
          </div>
        )}
        {weightOptions.length > 0 && (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {weightOptions.map((w) => (
              <Link key={w} href={href({ poids: weight === w ? "" : w })} scroll={false} replace className={small(weight === w)}>{w}</Link>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <div className="px-1 pb-2 text-xs font-semibold text-ink-3" aria-live="polite">
          {members.length} résultat{members.length > 1 ? "s" : ""}
        </div>
        {members.length === 0 ? (
          <div className="gph-card p-6 text-center text-sm text-ink-3">Aucun membre ne correspond.</div>
        ) : (
          <>
            {/* Téléphone / tablette : cartes */}
            <ul className="flex flex-col gap-2 lg:hidden">
              {members.map((m) => {
                const g = grades.get(m.id)?.grade;
                const ok = upToDate?.get(m.id);
                return (
                  <li key={m.id}>
                    <Link href={`/membres/${m.id}`} className="gph-card flex items-center gap-3 p-3">
                      <Avatar name={fullName(m)} size={44} photoUrl={m.photoUrl} />
                      <div className="min-w-0 flex-1">
                        <div className="mb-[3px] flex items-center gap-1.5">
                          <div className="truncate text-[15px] font-semibold">{fullName(m)}</div>
                          {m.position !== "ATHLETE" && (
                            <span className="gph-chip role flex-none" style={{ padding: "2px 7px", fontSize: 10 }}>
                              {POSITIONS[m.position as Position] ?? m.position}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-[5px] text-xs font-medium text-ink-3">
                          <Phone size={11} />
                          {m.phone ? formatPhone(m.phone) : "—"}
                          {g && <><span className="mx-0.5">·</span><BeltBadge grade={g} width={28} height={9} title={g.beltLabel} /> {gradeShortLabel(g)}</>}
                        </div>
                      </div>
                      {ok !== undefined && <FeeDot ok={ok} />}
                      <ChevronRight size={18} className="text-ink-3" />
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Ordinateur : tableau élargi (§6 Responsive) */}
            <div className="gph-card hidden overflow-hidden lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-divider bg-bg text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">
                  <tr>
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-3 py-3">Poste</th>
                    <th className="px-3 py-3">Groupe</th>
                    <th className="px-3 py-3">Grade</th>
                    <th className="px-3 py-3">Catégorie</th>
                    <th className="px-3 py-3">Téléphone</th>
                    {showFees && <th className="px-3 py-3">Cotisation</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const g = grades.get(m.id)?.grade;
                    const ok = upToDate?.get(m.id);
                    return (
                      <tr key={m.id} className="border-b border-divider last:border-none hover:bg-bg">
                        <td className="px-4 py-2.5">
                          <Link href={`/membres/${m.id}`} className="flex items-center gap-3 font-semibold">
                            <Avatar name={fullName(m)} size={32} photoUrl={m.photoUrl} />
                            {fullName(m)}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-ink-2">{POSITIONS[m.position as Position] ?? m.position}</td>
                        <td className="px-3 py-2.5 text-ink-2">{m.group?.name ?? "—"}</td>
                        <td className="px-3 py-2.5">
                          {g ? <span className="flex items-center gap-2"><BeltBadge grade={g} width={36} height={10} title={g.beltLabel} /><span className="text-xs text-ink-2">{gradeShortLabel(g)}</span></span> : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-ink-2">
                          {m.profile?.ageCategory ?? "—"}{m.profile?.weightCategory && ` · ${m.profile.weightCategory}`}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">{m.phone ? formatPhone(m.phone) : "—"}</td>
                        {showFees && <td className="px-3 py-2.5">{ok !== undefined && <FeeDot ok={ok} withLabel />}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Indicateur de cotisation à jour — jamais la couleur seule (§6 Accessibilité). */
function FeeDot({ ok, withLabel }: { ok: boolean; withLabel?: boolean }) {
  return (
    <span className={`gph-badge ${ok ? "success" : "warning"} flex-none`} title={ok ? "Cotisation à jour" : "Cotisation en retard"} aria-label={ok ? "Cotisation à jour" : "Cotisation en retard"}>
      {ok ? <Check size={11} strokeWidth={3} /> : <Clock size={11} strokeWidth={3} />}
      {withLabel ? (ok ? "À jour" : "En retard") : null}
    </span>
  );
}
