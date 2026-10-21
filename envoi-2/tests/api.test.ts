// Tests de l'API mobile (HTTP) contre un serveur lancé ; ignorés si le serveur est absent.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3200", db = new PrismaClient(), PW = "Test-Mobile-2026x";
let up = false, clientId: string, partnerUserId: string, adminId: string;
const post = (path: string, body: unknown, token?: string) => fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const get = (path: string, token?: string) => fetch(BASE + path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
const login = async (email: string) => (await post("/api/v1/auth/login", { email, password: PW, device: "test" })).json() as Promise<{ accessToken: string; refreshToken: string; error?: string }>;

before(async () => {
  up = await fetch(BASE, { signal: AbortSignal.timeout(3000) }).then(() => true, () => false); if (!up) return;
  const hash = await bcrypt.hash(PW, 10);
  const mk = async (email: string, role: string) => (await db.user.upsert({ where: { email }, update: { passwordHash: hash, active: true, failedLogins: 0, lockedUntil: null, deletedAt: null }, create: { email, role, passwordHash: hash, firstName: "Api", lastName: role, emailVerifiedAt: new Date() } })).id;
  clientId = await mk("apiclient@t.ch", "CLIENT"); partnerUserId = await mk("apipartner@t.ch", "PARTNER"); adminId = await mk("apiadmin@t.ch", "ADMIN");
  await db.partner.upsert({ where: { userId: partnerUserId }, update: {}, create: { userId: partnerUserId, displayName: "Api Partner", status: "APPROVED" } });
});
after(async () => { if (up) { await db.user.deleteMany({ where: { email: { in: ["apiclient@t.ch", "apipartner@t.ch", "apiadmin@t.ch"] } } }); } await db.$disconnect(); });
const t = (name: string, fn: () => Promise<void>) => test(name, async (c) => { if (!up) return c.skip("serveur absent"); await fn(); });

t("API mobile : mauvais mot de passe 401, pas de fuite sur l'existence du compte", async () => {
  const a = await post("/api/v1/auth/login", { email: "apiclient@t.ch", password: "mauvais-mot-de-passe" }), b = await post("/api/v1/auth/login", { email: "inconnu@t.ch", password: "mauvais-mot-de-passe" });
  assert.equal(a.status, 401); assert.equal(b.status, 401); assert.deepEqual(await a.json(), await b.json());
});
t("API mobile : connexion, profil, déconnexion = jeton mort immédiatement", async () => {
  const l = await login("apiclient@t.ch"); assert.ok(l.accessToken && l.refreshToken);
  const me = await get("/api/v1/me", l.accessToken); assert.equal(me.status, 200); const j = await me.json(); assert.equal(j.role, "CLIENT"); assert.ok(!("passwordHash" in j));
  assert.equal((await post("/api/v1/auth/logout", {}, l.accessToken)).status, 200);
  assert.equal((await get("/api/v1/me", l.accessToken)).status, 401);
});
t("API mobile : sans jeton, jeton falsifié ou cookie web : 401", async () => {
  assert.equal((await get("/api/v1/me")).status, 401); assert.equal((await get("/api/v1/me", "abc.def.ghi")).status, 401); assert.equal((await get("/api/v1/bookings")).status, 401);
});
t("API mobile : les comptes administrateur ne se connectent pas par l'application", async () => {
  const r = await post("/api/v1/auth/login", { email: "apiadmin@t.ch", password: PW }); assert.equal(r.status, 403);
});
t("API mobile : renouvellement avec rotation ; rejeu d'un ancien jeton = session coupée + alerte", async () => {
  const l = await login("apiclient@t.ch");
  const r1 = await post("/api/v1/auth/refresh", { refreshToken: l.refreshToken }); assert.equal(r1.status, 200); const n = await r1.json(); assert.ok(n.refreshToken && n.refreshToken !== l.refreshToken);
  assert.equal((await get("/api/v1/me", n.accessToken)).status, 200);
  const replay = await post("/api/v1/auth/refresh", { refreshToken: l.refreshToken }); assert.equal(replay.status, 401);          // ancien jeton rejoué
  assert.equal((await post("/api/v1/auth/refresh", { refreshToken: n.refreshToken })).status, 401);                               // la session entière est coupée
  assert.equal((await get("/api/v1/me", n.accessToken)).status, 401);
  assert.ok(await db.securityEvent.findFirst({ where: { type: "REFRESH_TOKEN_REUSE", userId: clientId } }));
});
t("API mobile : un client n'accède ni aux demandes de barbier ni aux réservations d'autrui", async () => {
  const c = await login("apiclient@t.ch"), p = await login("apipartner@t.ch");
  assert.equal((await get("/api/v1/partner/requests", c.accessToken)).status, 403);
  assert.equal((await get("/api/v1/partner/requests", p.accessToken)).status, 200);
  assert.equal((await get("/api/v1/bookings/inexistant", c.accessToken)).status, 404);
  assert.equal((await post("/api/v1/partner/bookings/x/respond", { accept: true }, c.accessToken)).status, 403);
});
t("API mobile : enregistrement d'un appareil push et suppression du compte depuis l'application", async () => {
  const l = await login("apiclient@t.ch"); const token = "fcm_" + "x".repeat(40);
  assert.equal((await post("/api/v1/devices", { platform: "ios", token }, l.accessToken)).status, 200); assert.equal(await db.device.count({ where: { token, userId: clientId } }), 1);
  assert.equal((await post("/api/v1/devices", { platform: "ios", token: "court" }, l.accessToken)).status, 400);
  const del = await fetch(BASE + "/api/v1/me", { method: "DELETE", headers: { authorization: `Bearer ${l.accessToken}` } }); assert.equal(del.status, 200);
  assert.equal((await get("/api/v1/me", l.accessToken)).status, 401);
});
