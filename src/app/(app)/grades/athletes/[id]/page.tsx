import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { GradeAthleteView } from "@/components/grade-athlete";
import { BackButton } from "@/components/ui";
import { db } from "@/lib/db";
import { requireMemberAccess } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Grades de l'athlète" };

export default async function AthleteGradesPage(props: PageProps<"/grades/athletes/[id]">) {
  const { id } = await props.params;
  const user = await requireMemberAccess(id);
  const member = await db.member.findUnique({ where: { id }, select: { id: true, firstName: true, lastName: true, photoUrl: true, matricule: true } });
  if (!member) notFound();
  const sp = await props.searchParams;
  return (
    <>
      <div className="flex items-center justify-between px-4 pb-2 pt-1.5">
        <BackButton href={can(user, "grade.manage") ? "/grades" : "/"} />
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
        {sp.ok && <p role="status" className="gph-badge success mb-3 w-full justify-center py-2.5 text-[13px]">Passage de grade enregistré.</p>}
        <GradeAthleteView memberId={member.id} canEdit={can(user, "grade.manage")} />
      </div>
    </>
  );
}
