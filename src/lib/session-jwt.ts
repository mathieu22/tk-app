// Signature / vérification du jeton de session (utilisable dans le proxy).
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "session";
export const MAX_AGE_DAYS = 30; // session persistante sur le téléphone (US-9.1)

export type SessionPayload = { userId: string; profile: string };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum)");
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_DAYS}d`)
    .sign(key());
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return { userId: String(payload.userId), profile: String(payload.profile) };
  } catch {
    return null;
  }
}
