import type { Metadata } from "next";
import { BackButton } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { NOTIFICATION_KINDS, prefsOf, type NotificationKind } from "@/lib/notify";
import { PreferencesForm } from "./preferences-form";

export const metadata: Metadata = { title: "Préférences de notification" };

export default async function PreferencesPage() {
  const user = await requireUser();
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { notificationPrefs: true } });
  const prefs = prefsOf(row.notificationPrefs);
  const kinds = (Object.keys(NOTIFICATION_KINDS) as NotificationKind[]).map((k) => ({ kind: k, label: NOTIFICATION_KINDS[k], ...prefs(k) }));
  return (
    <>
      <div className="flex items-center gap-3 px-4 pb-2 pt-3">
        <BackButton href="/mon-espace/notifications" />
        <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em]">Préférences</h1>
      </div>
      <PreferencesForm kinds={kinds} />
    </>
  );
}
