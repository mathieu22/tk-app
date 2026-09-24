import {
  Building2, ChevronRight, DatabaseBackup, History, KeyRound, ListChecks, MessageSquareText, Palette, Tags, UserCog, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ScreenHeader } from "@/components/ui";
import { requirePermission } from "@/lib/dal";
import type { Permission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Réglages" };

const SECTIONS: { href: string; label: string; description: string; Icon: LucideIcon; permission: Permission }[] = [
  { href: "/reglages/association", label: "Association", description: "Nom, logo, contacts, année scolaire, seuils", Icon: Building2, permission: "settings" },
  { href: "/reglages/couleurs", label: "Couleurs", description: "Personnalisation, contraste, mode sombre", Icon: Palette, permission: "settings" },
  { href: "/reglages/montants", label: "Montants", description: "Droit, Passport, Écolage par année scolaire", Icon: Wallet, permission: "settings" },
  { href: "/reglages/groupes", label: "Groupes", description: "Groupes / créneaux d'entraînement", Icon: Users, permission: "settings" },
  { href: "/reglages/evenements", label: "Types d'événements", description: "Stage, compétition, réunion…", Icon: Tags, permission: "settings" },
  { href: "/reglages/listes", label: "Statuts et postes", description: "Listes de la fiche athlète", Icon: ListChecks, permission: "settings" },
  { href: "/reglages/utilisateurs", label: "Utilisateurs", description: "Comptes, profils, invitations", Icon: UserCog, permission: "user.manage" },
  { href: "/reglages/permissions", label: "Permissions", description: "Matrice des droits par profil", Icon: KeyRound, permission: "settings" },
  { href: "/reglages/audit", label: "Journal d'audit", description: "Actions sensibles", Icon: History, permission: "audit.view" },
  { href: "/reglages/messages", label: "Messages", description: "SMS et emails envoyés ou en attente", Icon: MessageSquareText, permission: "settings" },
  { href: "/reglages/sauvegarde", label: "Sauvegarde et export", description: "Export complet Excel, sauvegarde quotidienne", Icon: DatabaseBackup, permission: "settings" },
];

export default async function SettingsPage() {
  const user = await requirePermission("settings");
  const sections = SECTIONS.filter((s) => user.perms.includes(s.permission));
  return (
    <>
      <ScreenHeader title="Réglages" sub="Paramètres et administration" />
      <div className="grid gap-2 px-4 lg:grid-cols-2">
        {sections.map(({ href, label, description, Icon }) => (
          <Link key={href} href={href} className="gph-card flex items-center gap-3.5 p-3.5">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold">{label}</span>
              <span className="block text-xs font-medium text-ink-3">{description}</span>
            </span>
            <ChevronRight size={18} className="text-ink-3" />
          </Link>
        ))}
      </div>
    </>
  );
}
