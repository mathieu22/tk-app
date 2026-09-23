// Ligne membre + badge de statut, commune aux détails Écolage / Droit / Passport.
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icon";
import { DUE_STATUS_META, type DueStatus } from "@/lib/domain";

export function StatusBadge({ status }: { status: DueStatus }) {
  const meta = DUE_STATUS_META[status];
  return (
    <span className={`gph-badge ${meta.tone} py-1 pl-1.5 pr-2 text-[11px]`}>
      <Icon name={meta.icon} size={12} strokeWidth={3} />
      {meta.label}
    </span>
  );
}

export function StatusRow({ name, photoUrl, detail, status, href }: {
  name: string; photoUrl?: string | null; detail: ReactNode; status: DueStatus; href?: string;
}) {
  const content = (
    <>
      <Avatar name={name} size={40} photoUrl={photoUrl} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="gph-amount mt-0.5 text-xs font-medium text-ink-3">{detail}</div>
      </div>
      <StatusBadge status={status} />
    </>
  );
  const cls = "gph-card flex items-center gap-3 p-2.5";
  return href ? <Link href={href} className={cls}>{content}</Link> : <div className={cls}>{content}</div>;
}

export function EmptyList({ children }: { children: ReactNode }) {
  return <div className="gph-card p-5 text-center text-sm text-ink-3">{children}</div>;
}
