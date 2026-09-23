// QR code membre (US-9.2) : le QR contient un jeton aléatoire de 192 bits, jamais l'id brut.
// Impossible à deviner ; le régénérer invalide l'ancien.
import { randomBytes } from "node:crypto";

const PREFIX = "GPH1:";

export const newQrToken = () => randomBytes(24).toString("base64url");

export const qrPayload = (token: string) => PREFIX + token;

export function parseQrPayload(text: string): string | null {
  const t = text.trim();
  if (!t.startsWith(PREFIX)) return null;
  const token = t.slice(PREFIX.length);
  return /^[A-Za-z0-9_-]{32}$/.test(token) ? token : null;
}
