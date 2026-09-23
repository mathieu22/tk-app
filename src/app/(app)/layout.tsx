import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { BottomNav, SideNav } from "@/components/nav";
import { requireStaff } from "@/lib/dal";
import { navFor } from "@/lib/nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireStaff();
  const nav = navFor(user.perms);
  return (
    <div className="flex min-h-screen">
      <SideNav {...nav} footer={
        <form action={logout}>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-3 hover:bg-bg">
            <LogOut size={20} /> Déconnexion
          </button>
        </form>
      } />
      {/* Colonne centrale : largeur téléphone sur mobile, élargie sur ordinateur (§6 Responsive) */}
      <main className="mx-auto w-full max-w-3xl pb-24 md:pb-8 md:pt-4 lg:max-w-5xl lg:px-4">{children}</main>
      <BottomNav {...nav} />
    </div>
  );
}
