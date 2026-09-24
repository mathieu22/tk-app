import type { Metadata } from "next";
import { AccountForm } from "@/components/treasury-account-form";
import { requirePermission } from "@/lib/dal";

export const metadata: Metadata = { title: "Nouveau compte" };

export default async function NewAccountPage() {
  await requirePermission("treasury.manage");
  return <AccountForm />;
}
