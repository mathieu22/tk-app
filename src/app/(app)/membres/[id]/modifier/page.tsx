import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MemberForm } from "@/components/member-form";
import type { TutorValue } from "@/components/member-tutor-field";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { gradeOptions, isoLocal } from "../../_lib";

export const metadata: Metadata = { title: "Modifier le membre" };

export default async function EditMemberPage({ params }: PageProps<"/membres/[id]/modifier">) {
  await requirePermission("member.edit");
  const { id } = await params;
  const [m, groups, grades] = await Promise.all([
    db.member.findUnique({
      where: { id },
      include: {
        parents: { include: { parent: { include: { user: { select: { lastLoginAt: true } } } } } },
        gradeHistory: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 1 },
        weighIns: { orderBy: { date: "desc" }, take: 1 },
      },
    }),
    db.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    gradeOptions(),
  ]);
  if (!m || m.archived) notFound();

  const tutor = (rank: number): TutorValue | undefined => {
    const l = m.parents.find((p) => p.rank === rank);
    return l && {
      parentId: l.parentId, lastName: l.parent.lastName, firstName: l.parent.firstName, phone: l.parent.phone,
      email: l.parent.email ?? "", relationship: l.relationship, invited: !!l.parent.user?.lastLoginAt,
    };
  };

  return (
    <MemberForm
      cancelHref={`/membres/${id}`}
      groups={groups}
      grades={grades}
      values={{
        id: m.id,
        lastName: m.lastName,
        firstName: m.firstName,
        sex: m.sex,
        birthDate: isoLocal(m.birthDate),
        birthPlace: m.birthPlace ?? "",
        nationality: m.nationality,
        phone: m.phone ?? "",
        email: m.email ?? "",
        facebook: m.facebook ?? "",
        address: m.address ?? "",
        position: m.position,
        status: m.status,
        joinedAt: isoLocal(m.joinedAt),
        groupId: m.groupId ?? "",
        bloodGroup: m.bloodGroup ?? "",
        medicalInfo: m.medicalInfo ?? "",
        photoUrl: m.photoUrl ?? "",
        photoConsent: m.photoConsent,
        licenseNo: m.licenseNo ?? "",
        kukkiwonNo: m.kukkiwonNo ?? "",
        gradeId: m.gradeHistory[0]?.gradeId ?? "",
        weightKg: m.weighIns[0] ? String(m.weighIns[0].weightKg).replace(".", ",") : "",
        tutor1: tutor(1),
        tutor2: tutor(2),
      }}
    />
  );
}
