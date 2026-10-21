import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

export const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const DAY = 86_400_000;

export async function createSession(o: { userId: string; kind: "WEB" | "APP"; ttlMs: number; device?: string | null; ip?: string | null }) {
  return db.session.create({ data: { userId: o.userId, kind: o.kind, expiresAt: new Date(Date.now() + o.ttlMs), device: o.device?.slice(0, 120) ?? null, ip: o.ip ?? null } });
}
/** Session valide = existe, non révoquée, non expirée, bien celle de cet utilisateur. */
export async function validSession(sid: string | undefined, uid: string) {
  if (!sid) return false;
  const s = await db.session.findUnique({ where: { id: sid } });
  if (!s || s.userId !== uid || s.revokedAt || s.expiresAt < new Date()) return false;
  if (Date.now() - s.lastSeenAt.getTime() > 5 * 60_000) await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  return true;
}
export const revokeSession = (id: string) => db.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
export const revokeAllSessions = (userId: string, exceptId?: string) => db.session.updateMany({ where: { userId, revokedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) }, data: { revokedAt: new Date() } });

/** Jeton de renouvellement (application mobile) : aléatoire, stocké haché, usage unique (rotation). */
export async function issueRefresh(sessionId: string) {
  const token = randomBytes(40).toString("base64url"), cur = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  await db.session.update({ where: { id: sessionId }, data: { prevRefreshHash: cur.refreshHash, refreshHash: sha(token), expiresAt: new Date(Date.now() + 90 * DAY) } });
  return token;
}
export type RefreshResult = { ok: true; session: { id: string; userId: string }; token: string } | { ok: false; reuse: boolean; userId?: string };
export async function rotateRefresh(token: string): Promise<RefreshResult> {
  const h = sha(token);
  const s = await db.session.findFirst({ where: { OR: [{ refreshHash: h }, { prevRefreshHash: h }] } });
  if (!s || s.revokedAt || s.expiresAt < new Date()) return { ok: false, reuse: false };
  if (s.prevRefreshHash === h && s.refreshHash !== h) { await revokeSession(s.id); return { ok: false, reuse: true, userId: s.userId }; } // ancien jeton rejoué → vol probable
  return { ok: true, session: { id: s.id, userId: s.userId }, token: await issueRefresh(s.id) };
}
