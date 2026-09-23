import { ChevronRight, Phone, Search, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { Avatar } from "@/components/avatar";
import { FilterChips, ScreenHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { BOARD_POSITIONS, fullName, MEMBER_STATUSES, POSITIONS, type Position } from "@/lib/domain";
import { formatPhone, normalizePhone } from "@/lib/format";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Membres" };

const ROLES = ["tous", "bureau", "membres", "nouveaux"] as const;
type Role = (typeof ROLES)[number];

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 3600 * 1000);

export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("attendance.viewAll");
  const association = await getAssociation();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const role: Role = ROLES.includes(sp.role as Role) ? (sp.role as Role) : "tous";
  const status = sp.statut && sp.statut in MEMBER_STATUSES ? sp.statut : "ACTIVE";

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
    ...(q && {
      OR: [
        { lastName: { contains: q.toUpperCase() } },
        { firstName: { contains: q } },
        { firstName: { contains: q.charAt(0).toUpperCase() + q.slice(1).toLowerCase() } },
        { phone: { contains: phoneQuery.replace(/^0/, "") } },
      ],
    }),
  };

  const [members, ...counts] = await Promise.all([
    db.member.findMany({
      where: { ...base, ...roleWhere[role] },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, position: true, phone: true, photoUrl: true },
    }),
    ...ROLES.map((r) => db.member.count({ where: { ...base, ...roleWhere[r] } })),
  ]);
  const activeCount = await db.member.count({ where: { archived: false, status: "ACTIVE" } });

  const href = (params: Record<string, string>) => {
    const next = new URLSearchParams({ ...(q && { q }), ...(role !== "tous" && { role }), ...(status !== "ACTIVE" && { statut: status }), ...params });
    for (const [k, v] of [...next]) if (!v || (k === "role" && v === "tous") || (k === "statut" && v === "ACTIVE")) next.delete(k);
    const s = next.toString();
    return s ? `/membres?${s}` : "/membres";
  };

  return (
    <>
      <ScreenHeader
        title="Membres"
        sub={`${activeCount} membre${activeCount > 1 ? "s" : ""} actif${activeCount > 1 ? "s" : ""}`}
        action={
          can(user.profile, "member.edit") && (
            <Link href="/membres/nouveau" className="gph-btn-primary">
              <UserPlus size={16} strokeWidth={2.5} />
              Ajouter
            </Link>
          )
        }
      />

      <form action="/membres" className="px-4 pb-3 pt-1" role="search">
        {role !== "tous" && <input type="hidden" name="role" value={role} />}
        {status !== "ACTIVE" && <input type="hidden" name="statut" value={status} />}
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input name="q" type="search" defaultValue={q} placeholder="Rechercher un membre" aria-label="Rechercher un membre" className="gph-input with-icon" />
        </div>
      </form>

      <div className="px-4 pb-2">
        <FilterChips
          active={role}
          hrefFor={(v) => href({ role: v })}
          options={[
            { value: "tous", label: "Tous", count: counts[0] },
            { value: "bureau", label: "Bureau", count: counts[1] },
            { value: "membres", label: "Membres", count: counts[2] },
            { value: "nouveaux", label: "Nouveaux", count: counts[3] },
          ]}
        />
      </div>
      <div className="px-4 pb-3">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {Object.entries(MEMBER_STATUSES).map(([value, label]) => (
            <Link
              key={value}
              href={href({ statut: value })}
              scroll={false}
              replace
              className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${value === status ? "bg-primary-soft text-primary" : "text-ink-3"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="px-1 pb-2 text-xs font-semibold text-ink-3" aria-live="polite">
          {members.length} résultat{members.length > 1 ? "s" : ""}
        </div>
        {members.length === 0 ? (
          <div className="gph-card p-6 text-center text-sm text-ink-3">Aucun membre ne correspond.</div>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
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
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
