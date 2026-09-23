import { redirect } from "next/navigation";
import { homeFor, requireUser } from "@/lib/dal";

export default async function Home() {
  const user = await requireUser();
  redirect(homeFor(user.profile));
}
