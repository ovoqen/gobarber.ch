import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "./db";
import { signSession, verifySession } from "@/lib/session";
import { createSession, validSession, issueRefresh, rotateRefresh, revokeSession } from "./sessions";
import { rateLimitShared } from "./rate-limit";
import { logSecurity, checkBruteForce } from "./security";
import { verifyTotp } from "@/modules/totp";

// Accès de l'application mobile : jeton d'accès court (15 min) + jeton de renouvellement (90 jours, usage unique, rotation, détection de vol).
// Réservé aux clients et aux barbiers : l'administration reste sur le web (2FA obligatoire).
const ACCESS_TTL_SEC = 15 * 60, APP_ROLES = ["CLIENT", "PARTNER"];
export const clientIpOf = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
export const apiError = (message: string, status = 400) => json({ error: message }, status);

async function tokens(user: { id: string; role: string }, sessionId: string) {
  const accessToken = await signSession({ uid: user.id, role: user.role, mfa: true, sid: sessionId }, Math.floor(Date.now() / 1000) + ACCESS_TTL_SEC);
  return { accessToken, expiresIn: ACCESS_TTL_SEC, refreshToken: await issueRefresh(sessionId) };
}

export async function apiLogin(req: Request, email: string, password: string, device?: string) {
  const ip = clientIpOf(req);
  const rl = await rateLimitShared(`apilogin:${ip}`, 10, 10 * 60_000);
  if (!rl.ok) { await logSecurity("RATE_LIMIT_LOGIN", "WARN", { ip, detail: "app" }); return apiError(`Trop de tentatives. Réessayez dans ${Math.ceil(rl.retryAfterSec / 60)} min.`, 429); }
  const generic = apiError("Identifiants incorrects.", 401);
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.active || user.deletedAt) { await bcrypt.compare(password, "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali"); return generic; }
  if (user.lockedUntil && user.lockedUntil > new Date()) return apiError("Compte temporairement verrouillé. Réessayez plus tard.", 423);
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    await db.user.update({ where: { id: user.id }, data: { failedLogins: failed, lockedUntil: failed >= 5 ? new Date(Date.now() + 15 * 60_000) : null } });
    await logSecurity("LOGIN_FAILED", "INFO", { userId: user.id, ip, detail: "app" }); await checkBruteForce(ip);
    if (failed >= 5) await logSecurity("ACCOUNT_LOCKED", "WARN", { userId: user.id, ip, detail: "app" });
    return generic;
  }
  if (!APP_ROLES.includes(user.role)) return apiError("Ce compte se connecte sur le site web.", 403);
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  const sess = await createSession({ userId: user.id, kind: "APP", ttlMs: 90 * 86_400_000, device: device ?? "application", ip });
  return json({ ...(await tokens(user, sess.id)), user: { id: user.id, role: user.role, firstName: user.firstName } });
}

export async function apiRefresh(req: Request, refreshToken: string) {
  const ip = clientIpOf(req);
  if (!(await rateLimitShared(`apirefresh:${ip}`, 60, 10 * 60_000)).ok) return apiError("Trop de requêtes.", 429);
  const r = await rotateRefresh(refreshToken);
  if (!r.ok) { if (r.reuse) await logSecurity("REFRESH_TOKEN_REUSE", "HIGH", { userId: r.userId, ip, detail: "session coupée : jeton rejoué" }); return apiError("Session expirée : reconnectez-vous.", 401); }
  const user = await db.user.findUnique({ where: { id: r.session.userId } });
  if (!user || !user.active || user.deletedAt) { await revokeSession(r.session.id); return apiError("Session expirée : reconnectez-vous.", 401); }
  // `rotateRefresh` a déjà émis le nouveau jeton de renouvellement.
  const accessToken = await signSession({ uid: user.id, role: user.role, mfa: true, sid: r.session.id }, Math.floor(Date.now() / 1000) + ACCESS_TTL_SEC);
  return json({ accessToken, expiresIn: ACCESS_TTL_SEC, refreshToken: r.token });
}

/** Authentifie une requête d'API (Authorization: Bearer …). Retourne l'utilisateur, ou null. */
export async function apiUser(req: Request) {
  const h = req.headers.get("authorization"); if (!h?.startsWith("Bearer ")) return null;
  const p = await verifySession(h.slice(7)); if (!p?.sid) return null;
  const user = await db.user.findUnique({ where: { id: p.uid }, include: { partner: true } });
  if (!user || !user.active || user.deletedAt || user.role !== p.role || !APP_ROLES.includes(user.role)) return null;
  if (!(await validSession(p.sid, user.id))) return null;
  return { ...user, sid: p.sid };
}
export { verifyTotp };
