import { BottomNav, SideNav } from "@/components/nav";
import { requireUser } from "@/lib/dal";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return (
    <div className="flex min-h-screen">
      <SideNav />
      {/* Colonne centrale : largeur téléphone sur mobile, élargie sur ordinateur */}
      <main className="mx-auto w-full max-w-3xl pb-24 md:pb-8 md:pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
