import "server-only";
import { cookies } from "next/headers";
import { decrypt, encrypt, MAX_AGE_DAYS, SESSION_COOKIE, type SessionPayload } from "./session-jwt";

export async function createSession(payload: SessionPayload) {
  const expires = new Date(Date.now() + MAX_AGE_DAYS * 24 * 3600 * 1000);
  (await cookies()).set(SESSION_COOKIE, await encrypt(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSession() {
  return decrypt((await cookies()).get(SESSION_COOKIE)?.value);
}
