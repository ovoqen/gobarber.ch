import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
/** Jeton à usage unique ; seul le hash est stocké. */
export async function issueToken(userId: string, type: "VERIFY_EMAIL" | "RESET_PASSWORD", ttlMin: number) {
  const token = randomBytes(32).toString("base64url");
  await db.authToken.create({ data: { userId, type, tokenHash: hash(token), expiresAt: new Date(Date.now() + ttlMin * 60_000) } });
  return token;
}
export async function consumeToken(token: string, type: string) {
  const row = await db.authToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  const res = await db.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return res.count === 1 ? row.userId : null;
}
