import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MemberForm } from "@/components/member-form";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";

export const metadata: Metadata = { title: "Modifier le membre" };

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("member.edit");
  const { id } = await params;
  const [m, groups] = await Promise.all([
    db.member.findUnique({ where: { id } }),
    db.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!m || m.archived) notFound();

  return (
    <MemberForm
      cancelHref={`/membres/${id}`}
      groups={groups}
      values={{
        id: m.id,
        lastName: m.lastName,
        firstName: m.firstName,
        sex: m.sex,
        birthDate: isoDate(m.birthDate),
        birthPlace: m.birthPlace ?? "",
        nationality: m.nationality,
        phone: m.phone ?? "",
        email: m.email ?? "",
        facebook: m.facebook ?? "",
        address: m.address ?? "",
        position: m.position,
        status: m.status,
        joinedAt: isoDate(m.joinedAt),
        groupId: m.groupId ?? "",
        bloodGroup: m.bloodGroup ?? "",
        medicalInfo: m.medicalInfo ?? "",
      }}
    />
  );
}
