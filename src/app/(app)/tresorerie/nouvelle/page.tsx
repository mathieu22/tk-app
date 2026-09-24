import type { Metadata } from "next";
import { OperationForm } from "@/components/treasury-operation-form";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Nouvelle opération" };

export default async function NewOperationPage(props: PageProps<"/tresorerie/nouvelle">) {
  const user = await requirePermission("treasury.manage");
  const sp = await props.searchParams;
  const type = ["INCOME", "EXPENSE", "TRANSFER"].includes(String(sp.type)) ? String(sp.type) : "EXPENSE";
  const [association, accounts, categories] = await Promise.all([
    getAssociation(),
    db.treasuryAccount.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // La catégorie système « Cotisations » est alimentée uniquement par les paiements.
    db.operationCategory.findMany({ where: { system: false }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }),
  ]);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return (
    <OperationForm initialType={type} accounts={accounts} categories={categories} today={today}
      approvalMin={association.expenseApprovalMin} canApprove={can(user, "expense.approve")} />
  );
}
