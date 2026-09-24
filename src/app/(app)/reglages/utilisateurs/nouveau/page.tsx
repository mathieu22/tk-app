import type { Metadata } from "next";
import { SettingsUserForm } from "@/components/settings-user-form";
import { SettingsHeader } from "@/components/settings-ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";

export const metadata: Metadata = { title: "Nouvel utilisateur" };

export default async function NewUserPage() {
  await requirePermission("user.manage");
  // Membres sans compte, pour lier le compte à une fiche (athlète, bureau, entraîneur)
  const members = await db.member.findMany({
    where: { archived: false, user: null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, position: true, phone: true, email: true, matricule: true },
  });
  return (
    <>
      <SettingsHeader title="Nouvel utilisateur" back="/reglages/utilisateurs"
        sub="Les comptes parents se créent depuis le module Parents (invitation liée aux enfants)." />
      <SettingsUserForm members={members.map((m) => ({ id: m.id, name: fullName(m), matricule: m.matricule, position: m.position, phone: m.phone ?? "", email: m.email ?? "" }))} />
    </>
  );
}
