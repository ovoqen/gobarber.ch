// Jeton de session signé (JWT, compatible runtime Edge pour le middleware). La validité réelle est revérifiée en base (table Session) : un jeton révoqué ne fonctionne plus.
import { SignJWT, jwtVerify } from "jose";
export const SESSION_COOKIE = "gb_session";
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET manquant");
  if (s && process.env.NODE_ENV === "production" && s.length < 32) throw new Error("SESSION_SECRET trop court (32 caractères minimum)");
  return new TextEncoder().encode(s || "dev-secret-change-me-at-least-32-characters-long");
};
/** mfa = false : admin authentifié par mot de passe mais 2FA non validée → accès limité à la page 2FA. sid = identifiant de la session en base. */
export type SessionPayload = { uid: string; role: string; mfa: boolean; sid?: string };
export async function signSession(p: SessionPayload, ttl: string | number = "12h") {
  return new SignJWT({ ...p }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(ttl).sign(secret());
}
export async function verifySession(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] }); return { uid: String(payload.uid), role: String(payload.role), mfa: payload.mfa === true, sid: payload.sid ? String(payload.sid) : undefined }; }
  catch { return null; }
}
