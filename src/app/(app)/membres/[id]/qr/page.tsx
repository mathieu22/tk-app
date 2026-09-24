import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "@/components/member-actions";
import { BackButton } from "@/components/ui";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { qrPayload } from "@/lib/qr";

export const metadata: Metadata = { title: "Code QR" };

/** QR en grand, prêt à imprimer (carte membre) — US-2.2. */
export default async function MemberQrPage({ params }: PageProps<"/membres/[id]/qr">) {
  await requirePermission("member.view");
  const { id } = await params;
  const [m, association] = await Promise.all([db.member.findUnique({ where: { id } }), getAssociation()]);
  if (!m || m.archived) notFound();
  const svg = await QRCode.toString(qrPayload(m.qrToken), { type: "svg", margin: 1, color: { dark: "#1A1A2E" } });
  return (
    <>
      <style>{"@media print { nav, aside { display: none !important } main { padding: 0 !important } }"}</style>
      <div className="flex items-center justify-between px-4 pb-2 pt-1.5 print:hidden">
        <BackButton href={`/membres/${id}`} />
        <PrintButton />
      </div>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-6 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-3">{association.name}</div>
        <div className="w-full rounded-2xl bg-white p-4 shadow-sm [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <div>
          <div className="text-2xl font-bold tracking-[-0.02em]">{fullName(m)}</div>
          <div className="mt-1 font-mono text-sm font-semibold text-ink-2">{m.matricule}</div>
        </div>
        <p className="text-xs text-ink-3 print:hidden">Présentez ce code à l&apos;entrée de chaque séance.</p>
      </div>
    </>
  );
}
