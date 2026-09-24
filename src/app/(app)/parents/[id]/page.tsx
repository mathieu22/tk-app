import { ChevronRight, Mail, Pencil, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { EspaceInviteButton, EspaceLinkChildForm, EspaceUnlinkButton } from "@/components/espace-parent-actions";
import { BackButton, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { formatDate, formatPhone } from "@/lib/format";
import { RELATIONSHIPS, type Relationship } from "@/lib/parents";
import { accountStatus } from "../status";

export const metadata: Metadata = { title: "Fiche parent" };

export default async function ParentPage(props: PageProps<"/parents/[id]">) {
  await requirePermission("parent.manage");
  const { id } = await props.params;
  const parent = await db.parent.findUnique({
    where: { id },
    include: {
      user: { select: { active: true, lastLoginAt: true } },
      children: { include: { member: true }, orderBy: { rank: "asc" } },
    },
  });
  if (!parent) notFound();
  const [members, log] = await Promise.all([
    db.member.findMany({
      where: { archived: false, id: { notIn: parent.children.map((c) => c.memberId) } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, matricule: true },
    }),
    db.auditLog.findMany({
      where: { OR: [{ entity: "Parent", entityId: id }, { action: { in: ["parent.link", "parent.unlink"] }, details: { startsWith: id } }] },
      orderBy: { at: "desc" }, take: 10, include: { user: { select: { phone: true } } },
    }),
  ]);
  const status = accountStatus(parent.user);
  const name = `${parent.firstName} ${parent.lastName}`;
  const ACTIONS: Record<string, string> = {
    "parent.create": "Création", "parent.update": "Modification", "parent.invite": "Invitation envoyée",
    "parent.link": "Association d'un athlète", "parent.unlink": "Dissociation d'un athlète",
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 pb-2 pt-1.5">
        <BackButton href="/parents" />
        <Link href={`/parents/${id}/modifier`} className="gph-icon-btn" aria-label="Modifier"><Pencil size={16} /></Link>
      </div>
      <div className="flex items-center gap-3.5 px-5 pb-4">
        <Avatar name={name} size={64} />
        <div className="min-w-0">
          <h1 className="m-0 truncate text-[24px] font-bold tracking-[-0.02em]">{name}</h1>
          <span className={`gph-badge ${status.tone} mt-1`}>{status.label}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 px-4 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-3.5">
          <div className="gph-card divide-y divide-divider">
            <a href={`tel:${parent.phone}`} className="flex items-center gap-3.5 px-3.5 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><Phone size={16} /></span>
              <span><span className="block text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">Téléphone</span><span className="text-sm font-semibold">{formatPhone(parent.phone)}</span></span>
            </a>
            <div className="flex items-center gap-3.5 px-3.5 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><Mail size={16} /></span>
              <span><span className="block text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">Email</span><span className="text-sm font-semibold">{parent.email ?? "—"}</span></span>
            </div>
          </div>

          <section>
            <SectionTitle>Compte</SectionTitle>
            <div className="gph-card p-3.5">
              <p className="mb-3 text-[13px] text-ink-2">
                {status.key === "actifs"
                  ? `Compte activé${parent.user?.lastLoginAt ? ` · dernière connexion le ${formatDate(parent.user.lastLoginAt)}` : ""}.`
                  : status.key === "invites"
                    ? "Invitation envoyée, en attente d'activation (lien valable 7 jours)."
                    : "Aucun compte : invitez le parent pour qu'il accède à l'espace de ses enfants."}
              </p>
              {status.key !== "actifs" && <EspaceInviteButton parentId={id} again={status.key === "invites"} />}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3.5">
          <section>
            <SectionTitle>Enfants associés</SectionTitle>
            <div className="flex flex-col gap-2">
              {parent.children.length === 0 && <div className="gph-card p-4 text-center text-sm text-ink-3">Aucun athlète associé.</div>}
              {parent.children.map((c) => (
                <div key={c.memberId} className="gph-card flex items-center gap-3 p-2.5">
                  <Link href={`/membres/${c.memberId}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={fullName(c.member)} size={40} photoUrl={c.member.photoUrl} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{fullName(c.member)}</span>
                      <span className="text-xs text-ink-3">{RELATIONSHIPS[c.relationship as Relationship] ?? c.relationship} · Tuteur {c.rank}{c.rank === 1 ? " (principal)" : ""}</span>
                    </span>
                    <ChevronRight size={16} className="ml-auto text-ink-3" />
                  </Link>
                  <EspaceUnlinkButton parentId={id} memberId={c.memberId} name={c.member.firstName} />
                </div>
              ))}
            </div>
            <EspaceLinkChildForm parentId={id} relationships={RELATIONSHIPS}
              members={members.map((m) => ({ id: m.id, name: `${m.lastName} ${m.firstName} (${m.matricule})` }))} />
          </section>

          {log.length > 0 && (
            <section>
              <SectionTitle>Journal</SectionTitle>
              <div className="gph-card divide-y divide-divider">
                {log.map((l) => (
                  <div key={l.id} className="flex justify-between gap-3 px-3.5 py-2.5 text-xs">
                    <span className="font-semibold">{ACTIONS[l.action] ?? l.action}</span>
                    <span className="text-ink-3">{formatDate(l.at)}{l.user ? ` · ${formatPhone(l.user.phone)}` : ""}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
