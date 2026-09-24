import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { auditLabel, PROFILE_LABELS } from "@/components/settings-defaults";
import { SettingsHeader } from "@/components/settings-ui";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { formatDate, formatPhone } from "@/lib/format";

export const metadata: Metadata = { title: "Journal d'audit" };

const PER_PAGE = 50;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export default async function AuditPage(props: PageProps<"/reglages/audit">) {
  await requirePermission("audit.view");
  const sp = await props.searchParams;
  const action = str(sp.action);
  const userId = str(sp.utilisateur);
  const entity = str(sp.entite);
  const from = isoDate.test(str(sp.du)) ? str(sp.du) : "";
  const to = isoDate.test(str(sp.au)) ? str(sp.au) : "";
  const page = Math.max(1, Number(str(sp.page)) || 1);

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(userId ? { userId } : {}),
    ...(entity ? { entity } : {}),
    ...(from || to ? { at: { ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}), ...(to ? { lt: new Date(new Date(`${to}T00:00:00`).getTime() + 86400e3) } : {}) } } : {}),
  };
  const [logs, total, actions, entities, users] = await Promise.all([
    db.auditLog.findMany({
      where, orderBy: { at: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE,
      include: { user: { include: { member: { select: { firstName: true, lastName: true } }, parent: { select: { firstName: true, lastName: true } } } } },
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    db.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
    db.user.findMany({
      where: { auditLogs: { some: {} } },
      include: { member: { select: { firstName: true, lastName: true } }, parent: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  const who = (u: (typeof users)[number] | null) => {
    if (!u) return "Système";
    const p = u.member ?? u.parent;
    return `${p ? fullName(p) : formatPhone(u.phone)} (${PROFILE_LABELS[u.profile] ?? u.profile})`;
  };
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (userId) params.set("utilisateur", userId);
    if (entity) params.set("entite", entity);
    if (from) params.set("du", from);
    if (to) params.set("au", to);
    params.set("page", String(p));
    return `/reglages/audit?${params}`;
  };

  return (
    <>
      <SettingsHeader title="Journal d'audit" sub={`${total} action${total > 1 ? "s" : ""} sensible${total > 1 ? "s" : ""}`} />
      <form className="grid gap-2 px-4 pb-3 sm:grid-cols-2 lg:grid-cols-6">
        <select name="action" defaultValue={action} aria-label="Action" className="gph-input lg:col-span-2">
          <option value="">Toutes les actions</option>
          {actions.map((a) => <option key={a.action} value={a.action}>{auditLabel(a.action)}</option>)}
        </select>
        <select name="utilisateur" defaultValue={userId} aria-label="Utilisateur" className="gph-input lg:col-span-2">
          <option value="">Tous les utilisateurs</option>
          {users.map((u) => <option key={u.id} value={u.id}>{who(u)}</option>)}
        </select>
        <select name="entite" defaultValue={entity} aria-label="Entité" className="gph-input lg:col-span-2">
          <option value="">Toutes les entités</option>
          {entities.map((e) => <option key={e.entity} value={e.entity}>{e.entity}</option>)}
        </select>
        <input type="date" name="du" defaultValue={from} aria-label="Du" className="gph-input lg:col-span-2" />
        <input type="date" name="au" defaultValue={to} aria-label="Au" className="gph-input lg:col-span-2" />
        <div className="flex gap-2 lg:col-span-2">
          <button className="gph-btn-primary flex-1">Filtrer</button>
          <Link href="/reglages/audit" className="gph-btn-ghost">Effacer</Link>
        </div>
      </form>

      <div className="px-4">
        <div className="gph-card overflow-hidden">
          {logs.length === 0 && <p className="p-6 text-center text-sm text-ink-3">Aucune action.</p>}
          <ul className="divide-y divide-divider">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-col gap-0.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-36 flex-none text-xs font-semibold text-ink-3">
                  {formatDate(l.at)} {l.at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{auditLabel(l.action)}</span>
                  {l.details && <span className="text-ink-2"> — {l.details}</span>}
                  <span className="block text-xs text-ink-3">{who(l.user)} · {l.entity}{l.entityId ? ` ${l.entityId.slice(0, 8)}…` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 py-4 text-sm font-semibold">
            {page > 1 ? <Link href={qs(page - 1)} className="gph-icon-btn" aria-label="Page précédente"><ChevronLeft size={18} /></Link> : <span className="w-9" />}
            <span>Page {page} / {pages}</span>
            {page < pages ? <Link href={qs(page + 1)} className="gph-icon-btn" aria-label="Page suivante"><ChevronRight size={18} /></Link> : <span className="w-9" />}
          </div>
        )}
      </div>
    </>
  );
}
