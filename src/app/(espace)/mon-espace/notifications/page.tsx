import { Award, Bell, CalendarX2, CheckCheck, Settings2, Trophy, Wallet, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { markAllNotificationsRead } from "@/app/actions/espace";
import { EspaceNotificationLink } from "@/components/espace-notification-link";
import { ScreenHeader } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

const KIND_ICON: Record<string, LucideIcon> = {
  ABSENCE: CalendarX2, PAYMENT: Wallet, OVERDUE: Wallet, GRADE: Award, RESULT: Trophy, EVENT: Bell,
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const list = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = list.filter((n) => !n.readAt).length;
  return (
    <>
      <ScreenHeader title="Notifications" sub={unread ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est lu"}
        action={<Link href="/mon-espace/preferences" className="gph-icon-btn" aria-label="Préférences"><Settings2 size={16} /></Link>} />
      <div className="flex flex-col gap-2 px-4">
        {unread > 0 && (
          <form action={markAllNotificationsRead} className="flex justify-end">
            <button className="flex min-h-[40px] items-center gap-1.5 text-[13px] font-semibold text-primary"><CheckCheck size={15} /> Tout marquer comme lu</button>
          </form>
        )}
        {list.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3">Aucune notification pour l&apos;instant.</div>}
        {list.map((n) => {
          const I = KIND_ICON[n.kind] ?? Bell;
          return (
            <EspaceNotificationLink key={n.id} id={n.id} href={n.url} unread={!n.readAt}>
              <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-[10px] ${n.readAt ? "bg-track text-ink-3" : "bg-primary-soft text-primary"}`}>
                <I size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${n.readAt ? "font-medium" : "font-bold"}`}>{n.title}</span>
                <span className="block text-[13px] text-ink-2">{n.body}</span>
                <span className="text-[11px] font-medium text-ink-3">
                  {formatDate(n.createdAt)} · {n.createdAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
              {!n.readAt && <span className="gph-dot mt-1.5" style={{ background: "var(--gph-primary)" }} />}
            </EspaceNotificationLink>
          );
        })}
      </div>
    </>
  );
}
