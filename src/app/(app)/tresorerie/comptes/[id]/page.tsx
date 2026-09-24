import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountForm } from "@/components/treasury-account-form";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";

export const metadata: Metadata = { title: "Modifier le compte" };

export default async function EditAccountPage(props: PageProps<"/tresorerie/comptes/[id]">) {
  await requirePermission("treasury.manage");
  const { id } = await props.params;
  const account = await db.treasuryAccount.findUnique({ where: { id } });
  if (!account) notFound();
  return <AccountForm account={account} />;
}
