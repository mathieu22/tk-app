import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { PalmaresAthleteView } from "@/components/palmares-athlete";
import { BackButton } from "@/components/ui";
import { db } from "@/lib/db";
import { requireMemberAccess } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Palmarès de l'athlète" };

export default async function AthletePalmaresPage(props: PageProps<"/palmares/athletes/[id]">) {
  const { id } = await props.params;
  const user = await requireMemberAccess(id);
  const member = await db.member.findUnique({ where: { id }, select: { id: true, firstName: true, lastName: true, photoUrl: true, matricule: true } });
  if (!member) notFound();
  const canEdit = can(user, "palmares.manage");
  return (
    <>
      <div className="flex items-center justify-between px-4 pb-2 pt-1.5">
        <BackButton href={canEdit ? "/palmares" : "/"} />
        <Link href={`/membres/${member.id}`} className="text-xs font-semibold text-primary">Fiche membre</Link>
      </div>
      <div className="flex items-center gap-3 px-5 pb-4">
        <Avatar name={fullName(member)} size={52} photoUrl={member.photoUrl} />
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em]">{fullName(member)}</h1>
          <div className="font-mono text-xs text-ink-3">{member.matricule}</div>
        </div>
      </div>
      <div className="px-4">
        <PalmaresAthleteView memberId={member.id} canEdit={canEdit} />
      </div>
    </>
  );
}
