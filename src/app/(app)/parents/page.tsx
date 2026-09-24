import { ChevronRight, Phone, Search, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { FilterChips, ScreenHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { formatPhone, normalizePhone } from "@/lib/format";
import { accountStatus } from "./status";

export const metadata: Metadata = { title: "Parents" };

export default async function ParentsPage(props: PageProps<"/parents">) {
  await requirePermission("parent.manage");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filter = ["tous", "actifs", "invites", "sans"].includes(String(sp.compte)) ? String(sp.compte) : "tous";
  const phone = q ? normalizePhone(q) : null;

  const parents = await db.parent.findMany({
    where: q ? (phone ? { phone } : { OR: [{ lastName: { contains: q.toUpperCase() } }, { firstName: { contains: q } }] }) : {},
    include: { user: { select: { active: true, lastLoginAt: true } }, children: { include: { member: { select: { firstName: true, lastName: true } } }, orderBy: { rank: "asc" } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const withStatus = parents.map((p) => ({ p, status: accountStatus(p.user) }));
  const count = (k: string) => withStatus.filter((x) => x.status.key === k).length;
  const shown = withStatus.filter((x) => filter === "tous" || x.status.key === filter);
  const href = (v: string) => `/parents?compte=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <ScreenHeader title="Parents" sub={`${parents.length} parent${parents.length > 1 ? "s" : ""}`}
        action={<Link href="/parents/nouveau" className="gph-btn-primary"><UserPlus size={16} strokeWidth={2.5} /> Ajouter</Link>} />
      <form className="px-4 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input name="q" defaultValue={q} placeholder="Nom ou téléphone" className="gph-input with-icon" />
          {filter !== "tous" && <input type="hidden" name="compte" value={filter} />}
        </div>
      </form>
      <div className="px-4 pb-3">
        <FilterChips active={filter} hrefFor={href} options={[
          { value: "tous", label: "Tous", count: parents.length },
          { value: "actifs", label: "Compte activé", count: count("actifs") },
          { value: "invites", label: "Invités", count: count("invites") },
          { value: "sans", label: "Sans compte", count: count("sans") },
        ]} />
      </div>
      <div className="grid gap-2 px-4 lg:grid-cols-2">
        {shown.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3 lg:col-span-2">Aucun parent.</div>}
        {shown.map(({ p, status }) => (
          <Link key={p.id} href={`/parents/${p.id}`} className="gph-card flex items-center gap-3 p-3">
            <Avatar name={`${p.firstName} ${p.lastName}`} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold">{p.firstName} {p.lastName}</div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-ink-3"><Phone size={11} />{formatPhone(p.phone)}</div>
              <div className="truncate text-xs text-ink-2">
                {p.children.length ? p.children.map((c) => c.member.firstName).join(", ") : "Aucun enfant associé"}
              </div>
            </div>
            <span className={`gph-badge ${status.tone}`}>{status.label}</span>
            <ChevronRight size={18} className="text-ink-3" />
          </Link>
        ))}
      </div>
    </>
  );
}
