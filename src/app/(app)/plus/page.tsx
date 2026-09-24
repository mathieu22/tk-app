import { ChevronRight, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { ScreenHeader } from "@/components/ui";
import { requireStaff } from "@/lib/dal";
import { formatPhone } from "@/lib/format";
import { navFor } from "@/lib/nav";
import { navIcon } from "@/lib/nav-icons";

export const metadata: Metadata = { title: "Plus" };

const PROFILE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur", PRESIDENT: "Président", SECRETARY: "Secrétaire", TREASURER: "Trésorier", COACH: "Encadrant",
};

export default async function MorePage() {
  const user = await requireStaff();
  const { secondary } = navFor(user.perms);
  return (
    <>
      <ScreenHeader title="Plus" sub={`${PROFILE_LABELS[user.profile] ?? user.profile} · ${formatPhone(user.phone)}`} />
      <div className="flex flex-col gap-2 px-4">
        {secondary.map(({ href, label, icon, description }) => {
          const Icon = navIcon(icon);
          return (
            <Link key={href} href={href} className="gph-card flex items-center gap-3.5 p-3.5">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{label}</span>
                {description && <span className="block text-xs font-medium text-ink-3">{description}</span>}
              </span>
              <ChevronRight size={18} className="text-ink-3" />
            </Link>
          );
        })}
        <form action={logout} className="mt-4">
          <button className="gph-btn-ghost w-full text-danger">
            <LogOut size={16} /> Déconnexion
          </button>
        </form>
      </div>
    </>
  );
}
