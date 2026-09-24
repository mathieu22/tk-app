import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { auditLabel, PROFILE_LABELS } from "@/components/settings-defaults";
import { SettingsUserActions } from "@/components/settings-user-actions";
import { Card, SettingsHeader } from "@/components/settings-ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { formatDate, formatPhone } from "@/lib/format";

export const metadata: Metadata = { title: "Utilisateur" };

const dt = (d: Date) => `${formatDate(d)} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

export default async function UserPage(props: PageProps<"/reglages/utilisateurs/[id]">) {
  const admin = await requirePermission("user.manage");
  const { id } = await props.params;
  const u = await db.user.findUnique({
    where: { id },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, matricule: true } },
      parent: { include: { children: { include: { member: { select: { id: true, firstName: true, lastName: true } } } } } },
    },
  });
  if (!u) notFound();
  const [logs, pendingInvite] = await Promise.all([
    db.auditLog.findMany({ where: { OR: [{ userId: u.id }, { entity: "User", entityId: u.id }] }, orderBy: { at: "desc" }, take: 10 }),
    db.authToken.findFirst({ where: { userId: u.id, kind: { in: ["INVITE", "RESET"] }, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  const person = u.member ?? u.parent;
  const name = person ? fullName(person) : formatPhone(u.phone);

  return (
    <>
      <SettingsHeader title={name} back="/reglages/utilisateurs" sub={`${PROFILE_LABELS[u.profile] ?? u.profile}${u.active ? "" : " · désactivé"}`} />
      <div className="grid gap-4 px-4 lg:grid-cols-2 lg:items-start">
        <Card>
          <div className="mb-3 flex items-center gap-3">
            <Avatar name={name} size={52} />
            <div className="min-w-0">
              <div className="text-base font-bold">{name}</div>
              <div className="text-xs text-ink-3">Créé le {formatDate(u.createdAt)}</div>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-3">Téléphone</dt><dd className="font-semibold">{formatPhone(u.phone)}</dd>
            <dt className="text-ink-3">Email</dt><dd className="font-semibold">{u.email ?? "—"}</dd>
            <dt className="text-ink-3">Dernière connexion</dt><dd className="font-semibold">{u.lastLoginAt ? dt(u.lastLoginAt) : "Jamais"}</dd>
            {u.member && (
              <><dt className="text-ink-3">Fiche membre</dt>
              <dd><Link href={`/membres/${u.member.id}`} className="font-semibold text-primary">{fullName(u.member)} · {u.member.matricule}</Link></dd></>
            )}
            {u.parent && (
              <><dt className="text-ink-3">Enfants</dt>
              <dd className="font-semibold">{u.parent.children.map((c) => fullName(c.member)).join(", ") || "—"}</dd></>
            )}
            {pendingInvite && (
              <><dt className="text-ink-3">Lien en attente</dt>
              <dd className="font-semibold">{pendingInvite.kind === "INVITE" ? "Invitation" : "Réinitialisation"} jusqu&apos;au {formatDate(pendingInvite.expiresAt)}</dd></>
            )}
          </dl>
        </Card>

        <SettingsUserActions userId={u.id} profile={u.profile} active={u.active} self={u.id === admin.id} />

        <Card title="Activité récente" className="lg:col-span-2">
          {logs.length === 0 ? (
            <p className="text-sm text-ink-3">Aucune action journalisée.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-divider text-sm">
              {logs.map((l) => (
                <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-semibold">{auditLabel(l.action)}{l.details && <span className="font-normal text-ink-3"> — {l.details}</span>}</span>
                  <span className="text-xs text-ink-3">{dt(l.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
