import type { Metadata } from "next";
import { ReminderList } from "@/components/pay-reminders";
import { BackButton } from "@/components/ui";
import { getAssociation, requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { ensureDues } from "@/lib/fees";
import { formatAriary, formatPhone } from "@/lib/format";
import { can } from "@/lib/permissions";
import { overdueFor } from "../overdue";

export const metadata: Metadata = { title: "Relances" };

export default async function Reminders() {
  const user = await requirePermission("payment.viewAll");
  const { currentSchoolYear } = await getAssociation();
  await ensureDues(currentSchoolYear);
  const rows = await overdueFor(currentSchoolYear);
  const total = rows.reduce((n, r) => n + r.total, 0);

  return (
    <div>
      <div className="flex items-center px-4 pt-1.5">
        <BackButton href="/cotisations" />
      </div>
      <div className="px-5 pb-3 pt-2">
        <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Relances</h1>
        <div className="mt-0.5 text-xs font-semibold text-ink-3">
          {rows.length} membre{rows.length > 1 ? "s" : ""} en retard · <span className="gph-amount">{formatAriary(total)}</span> à recouvrer · {currentSchoolYear}
        </div>
      </div>
      <ReminderList
        canSend={can(user, "payment.create")}
        rows={rows.map((r) => ({
          memberId: r.memberId,
          name: fullName(r.member),
          photoUrl: r.member.photoUrl,
          total: r.total,
          details: r.details,
          recipientName: r.recipientName,
          recipientRole: r.recipientRole,
          phone: r.recipientPhone ? formatPhone(r.recipientPhone) : null,
          message: r.message,
        }))}
      />
    </div>
  );
}
