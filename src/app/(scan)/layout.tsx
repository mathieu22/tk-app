import { requireUser } from "@/lib/dal";

// Plein écran, sans barre de navigation (écran 02 du design).
export default async function ScanLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return <div className="h-dvh bg-[#0A0D0E]">{children}</div>;
}
