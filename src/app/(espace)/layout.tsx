import { Eye, LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { EspaceBottomNav, EspaceSideNav } from "@/components/espace-nav";
import { requireUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { isStaff } from "@/lib/permissions";

// Espace parent / athlète (§3.2). Le staff peut le prévisualiser.
export default async function EspaceLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const preview = isStaff(user.profile);
  return (
    <div className="flex min-h-screen">
      <Suspense>
        <EspaceSideNav unread={unread} footer={
          <form action={logout}>
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-3 hover:bg-bg">
              <LogOut size={20} /> Déconnexion
            </button>
          </form>
        } />
      </Suspense>
      <main className="mx-auto w-full max-w-3xl pb-24 md:pb-8 md:pt-4 lg:max-w-4xl lg:px-4">
        {preview && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">
            <Eye size={14} /> Prévisualisation de l&apos;espace parent / athlète
            <Link href="/presence" className="ml-auto underline">Retour</Link>
          </div>
        )}
        {children}
      </main>
      <Suspense>
        <EspaceBottomNav unread={unread} />
      </Suspense>
    </div>
  );
}
