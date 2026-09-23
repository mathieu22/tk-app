"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { homeFor } from "@/lib/dal";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { createSession, deleteSession } from "@/lib/session";

// Hash factice : comparé quand le compte n'existe pas.
const DUMMY_HASH = "$2b$10$3roJzNjoZYguql7QMSUf9.2M9oAo/o8ToSo9j1Tt5THBKuqWG4HtS";

export type LoginState = { error?: string; phone?: string } | undefined;

const schema = z.object({ phone: z.string().min(1), password: z.string().min(1) });

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Renseignez le téléphone et le mot de passe." };

  const rawPhone = parsed.data.phone;
  const phone = normalizePhone(rawPhone);
  const user = phone ? await db.user.findUnique({ where: { phone } }) : null;
  // Toujours comparer un hash pour ne pas révéler l'existence du compte par le temps de réponse.
  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.active || !ok) return { error: "Téléphone ou mot de passe incorrect.", phone: rawPhone };

  await createSession({ userId: user.id, profile: user.profile });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  redirect(homeFor(user.profile));
}

export async function logout() {
  await deleteSession();
  redirect("/connexion");
}
