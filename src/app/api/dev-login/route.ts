import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import { createSession } from "@/lib/sessions";

// Connexion rapide POUR LE DÉVELOPPEMENT LOCAL uniquement : désactivée en production, désactivée sans DEV_AUTOLOGIN=1,
// et refusée si l'adresse n'est pas localhost. Ne fonctionne qu'avec les comptes de démo (@gobarber.test).
const ACCOUNTS = { admin: ["admin@gobarber.test", "/admin"], support: ["support@gobarber.test", "/admin"], partner: ["barbier1@gobarber.test", "/partenaire"], qendrim: ["qendrim@gobarber.test", "/partenaire"], client: ["client@gobarber.test", "/compte"] } as const;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (process.env.NODE_ENV === "production" || process.env.DEV_AUTOLOGIN !== "1" || !local) return new NextResponse(null, { status: 404 });
  const who = (url.searchParams.get("as") ?? "") as keyof typeof ACCOUNTS;
  const acc = ACCOUNTS[who]; if (!acc) return NextResponse.json({ usage: "/api/dev-login?as=admin|support|partner|qendrim|client" }, { status: 400 });
  const user = await db.user.findUnique({ where: { email: acc[0] } });
  if (!user || !user.active || user.deletedAt) return NextResponse.json({ error: "Compte de démo absent : npm run db:seed -- --demo" }, { status: 404 });
  const staff = user.role === "ADMIN" || user.role === "SUPPORT";
  const res = NextResponse.redirect(new URL(acc[1], url));
  const sess = await createSession({ userId: user.id, kind: "WEB", ttlMs: 8 * 3600_000, device: "dev-login" });
  res.cookies.set(SESSION_COOKIE, await signSession({ uid: user.id, role: user.role, mfa: true, sid: sess.id }, "8h"), { httpOnly: true, sameSite: "lax", path: "/", maxAge: staff ? 8 * 3600 : 30 * 86400 });
  return res;
}
