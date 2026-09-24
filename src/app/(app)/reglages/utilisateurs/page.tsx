import { ChevronRight, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { PROFILE_LABELS } from "@/components/settings-defaults";
import { SettingsHeader } from "@/components/settings-ui";
import { FilterChips } from "@/components/ui";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { formatDate, formatPhone } from "@/lib/format";

export const metadata: Metadata = { title: "Utilisateurs" };

const FILTERS = [
  { value: "tous", label: "Tous" },
  { value: "staff", label: "Staff" },
  { value: "athletes", label: "Athlètes" },
  { value: "parents", label: "Parents" },
  { value: "inactifs", label: "Désactivés" },
];

export default async function UsersPage(props: PageProps<"/reglages/utilisateurs">) {
  await requirePermission("user.manage");
  const sp = await props.searchParams;
  const filter = FILTERS.some((f) => f.value === sp.filtre) ? String(sp.filtre) : "tous";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where: Prisma.UserWhereInput = {
    ...(filter === "staff" ? { profile: { in: ["ADMIN", "PRESIDENT", "SECRETARY", "TREASURER", "COACH"] }, active: true } : {}),
    ...(filter === "athletes" ? { profile: "ATHLETE", active: true } : {}),
    ...(filter === "parents" ? { profile: "PARENT", active: true } : {}),
    ...(filter === "inactifs" ? { active: false } : {}),
    ...(q ? { OR: [
      { phone: { contains: q.replace(/\D/g, "").replace(/^0/, "") || q } }, { email: { contains: q } },
      { member: { OR: [{ lastName: { contains: q } }, { firstName: { contains: q } }] } },
      { parent: { OR: [{ lastName: { contains: q } }, { firstName: { contains: q } }] } },
    ] } : {}),
  };
  const users = await db.user.findMany({
    where,
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    include: { member: { select: { firstName: true, lastName: true } }, parent: { select: { firstName: true, lastName: true } } },
    take: 300,
  });

  return (
    <>
      <SettingsHeader title="Utilisateurs" sub={`${users.length} compte${users.length > 1 ? "s" : ""}`}
        action={<Link href="/reglages/utilisateurs/nouveau" className="gph-btn-primary"><UserPlus size={16} /> Nouveau</Link>} />
      <form className="px-4 pb-3">
        {filter !== "tous" && <input type="hidden" name="filtre" value={filter} />}
        <input name="q" defaultValue={q} placeholder="Rechercher (nom, téléphone, email)" aria-label="Rechercher" className="gph-input" />
      </form>
      <div className="px-4 pb-3">
        <FilterChips options={FILTERS} active={filter}
          hrefFor={(v) => `/reglages/utilisateurs?filtre=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
      </div>
      <div className="grid gap-2 px-4 lg:grid-cols-2">
        {users.map((u) => {
          const person = u.member ?? u.parent;
          const name = person ? fullName(person) : formatPhone(u.phone);
          return (
            <Link key={u.id} href={`/reglages/utilisateurs/${u.id}`} className={`gph-card flex items-center gap-3 p-3 ${u.active ? "" : "opacity-60"}`}>
              <Avatar name={name} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-semibold">{name}</span>
                  <span className="gph-chip role px-[7px] py-0.5 text-[10px]">{PROFILE_LABELS[u.profile] ?? u.profile}</span>
                </div>
                <div className="truncate text-xs font-medium text-ink-3">
                  {formatPhone(u.phone)}
                  {!u.active ? " · désactivé" : u.lastLoginAt ? ` · connecté le ${formatDate(u.lastLoginAt)}` : " · jamais connecté"}
                </div>
              </div>
              <ChevronRight size={18} className="text-ink-3" />
            </Link>
          );
        })}
        {users.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3 lg:col-span-2">Aucun utilisateur.</div>}
      </div>
    </>
  );
}
