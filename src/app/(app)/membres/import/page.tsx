import type { Metadata } from "next";
import { requirePermission } from "@/lib/dal";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Importer les membres" };

export default async function ImportMembersPage() {
  await requirePermission("member.import");
  return <ImportWizard />;
}
