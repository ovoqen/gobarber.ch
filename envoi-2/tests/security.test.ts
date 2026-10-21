// Tests d'accès HTTP contre un serveur lancé (`npm run dev`, base de démo avec `npm run db:seed -- --demo`). Ignorés si le serveur est absent.
import test, { before } from "node:test";
import assert from "node:assert/strict";
import { signSession } from "../src/lib/session";
import { signWebhook } from "../src/modules/payments/provider";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const db = new PrismaClient();
let up = false, client: string, partner1: string, partner2: string, clientCookie: string, p1Cookie: string, p2Cookie: string, bookingId: string;
const cookie = async (uid: string, role: string, mfa = true) => { const sess = await db.session.create({ data: { userId: uid, kind: "WEB", expiresAt: new Date(Date.now() + 3600_000), device: "test" } }); return `gb_session=${await signSession({ uid, role, mfa, sid: sess.id })}`; };
const sidOf = (ck: string) => JSON.parse(Buffer.from(ck.split("=")[1].split(".")[1], "base64url").toString()).sid as string;
const get = (path: string, ck?: string) => fetch(BASE + path, { redirect: "manual", headers: ck ? { cookie: ck } : {} });

before(async () => {
  up = await fetch(BASE, { signal: AbortSignal.timeout(3000) }).then(() => true, () => false);
  if (!up) return;
  const u = async (email: string) => (await db.user.findUniqueOrThrow({ where: { email } })).id;
  client = await u("client@gobarber.test"); partner1 = await u("barbier1@gobarber.test"); partner2 = await u("barbier2@gobarber.test");
  [clientCookie, p1Cookie, p2Cookie] = await Promise.all([cookie(client, "CLIENT"), cookie(partner1, "PARTNER"), cookie(partner2, "PARTNER")]);
  bookingId = (await db.booking.findFirstOrThrow({ where: { clientId: client, partner: { userId: partner1 } } })).id;
});
const t = (name: string, fn: () => Promise<void>) => test(name, async (c) => { if (!up) return c.skip("serveur absent"); await fn(); });

t("zones privées sans session : redirection vers la connexion", async () => {
  for (const p of ["/compte", "/partenaire", "/admin", "/admin/audit", `/compte/reservations/${bookingId}`]) { const r = await get(p); assert.equal(r.status, 307, p); }
});
t("cookie falsifié ou signé avec un autre secret : refusé", async () => {
  assert.equal((await get("/compte", "gb_session=abc.def.ghi")).status, 307);
  assert.equal((await get("/admin", "gb_session=" + (await cookie(client, "ADMIN")).split("=")[1].slice(0, -3) + "xyz")).status, 307);
});
t("un client voit sa réservation, un autre client reçoit 404", async () => {
  assert.equal((await get(`/compte/reservations/${bookingId}`, clientCookie)).status, 200);
  const other = await db.user.upsert({ where: { email: "other@gobarber.test" }, update: {}, create: { email: "other@gobarber.test", passwordHash: "x", firstName: "O", lastName: "T", emailVerifiedAt: new Date() } });
  assert.equal((await get(`/compte/reservations/${bookingId}`, await cookie(other.id, "CLIENT"))).status, 404);
});
t("un barbier ne voit pas la réservation d'un autre barbier", async () => {
  assert.equal((await get(`/partenaire/reservations/${bookingId}`, p1Cookie)).status, 200);
  assert.equal((await get(`/partenaire/reservations/${bookingId}`, p2Cookie)).status, 404);
});
t("un client / barbier n'entre pas dans l'administration, ni l'inverse", async () => {
  for (const ck of [clientCookie, p1Cookie]) { const r = await get("/admin", ck); assert.equal(r.status, 307); assert.ok(!r.headers.get("location")!.includes("/admin/2fa")); }
  assert.equal((await get("/partenaire", clientCookie)).status, 307); assert.equal((await get("/compte", p1Cookie)).status, 307);
});
t("administrateur sans 2FA validée : bloqué sur la page 2FA", async () => {
  const admin = (await db.user.findUniqueOrThrow({ where: { email: "admin@gobarber.test" } })).id;
  const r = await get("/admin/partenaires", await cookie(admin, "ADMIN", false)); assert.equal(r.status, 307); assert.ok(r.headers.get("location")!.endsWith("/admin/2fa"));
  assert.equal((await get("/api/admin/export", await cookie(admin, "ADMIN", false))).status, 307);
});
t("le support ne peut pas ouvrir les pages réservées à l'administrateur", async () => {
  const sup = (await db.user.findUniqueOrThrow({ where: { email: "support@gobarber.test" } })).id; const ck = await cookie(sup, "SUPPORT");
  for (const p of ["/admin/paiements", "/admin/utilisateurs", "/admin/parametres", "/admin/audit"]) { const r = await get(p, ck); assert.equal(r.status, 307, p); }
});
t("calendrier : le Support en lecture seule ne peut ni ajouter ni déplacer ; le barbier non autorisé non plus", async () => {
  const sup = (await db.user.findUniqueOrThrow({ where: { email: "support@gobarber.test" } })); await db.user.update({ where: { id: sup.id }, data: { canEditCalendar: false } });
  const ck = await cookie(sup.id, "SUPPORT");
  assert.equal((await get("/admin/calendrier", ck)).status, 200);
  const r = await get("/admin/calendrier/nouveau", ck); assert.equal(r.status, 307); assert.ok(r.headers.get("location")!.includes("/admin/calendrier"));
  await db.partner.updateMany({ where: { userId: partner1 }, data: { canManageCalendar: false } });
  const pr = await get("/partenaire/nouveau-rdv", p1Cookie); assert.equal(pr.status, 307);
  await db.user.update({ where: { id: sup.id }, data: { canEditCalendar: true } }); assert.equal((await get("/admin/calendrier/nouveau", ck)).status, 200); // droit accordé : accès
  await db.user.update({ where: { id: sup.id }, data: { canEditCalendar: false } });
});
t("rôle rétrogradé en base : le jeton ne suffit pas", async () => {
  const forged = await cookie(client, "ADMIN", true); const r = await get("/admin", forged); assert.equal(r.status, 307);
});
t("export de données personnelles : jamais de hash de mot de passe, 401 sans session", async () => {
  assert.equal((await fetch(BASE + "/api/me/export")).status, 401);
  const body = await (await fetch(BASE + "/api/me/export", { headers: { cookie: clientCookie } })).text();
  assert.ok(!/passwordHash|totpSecret|\$2[aby]\$/.test(body));
});
t("webhook : signature invalide / absente refusée, valide acceptée et rejouée ignorée", async () => {
  const body = JSON.stringify({ id: "evt_sec_" + Date.now(), type: "noop" });
  assert.equal((await fetch(BASE + "/api/webhooks/payments", { method: "POST", body })).status, 400);
  assert.equal((await fetch(BASE + "/api/webhooks/payments", { method: "POST", body, headers: { "x-gobarber-signature": "t=1,v1=00" } })).status, 400);
  const sig = signWebhook(body, process.env.PAYMENT_WEBHOOK_SECRET ?? "dev-webhook-secret");
  const ok = await fetch(BASE + "/api/webhooks/payments", { method: "POST", body, headers: { "x-gobarber-signature": sig } }); assert.equal((await ok.json()).result, "processed");
  assert.equal((await (await fetch(BASE + "/api/webhooks/payments", { method: "POST", body, headers: { "x-gobarber-signature": sig } })).json()).result, "duplicate");
});
t("paiement : un autre client ne peut pas payer ma réservation", async () => {
  const other = await db.user.findUniqueOrThrow({ where: { email: "other@gobarber.test" } });
  const r = await fetch(`${BASE}/api/bookings/${bookingId}/pay`, { method: "POST", headers: { cookie: await cookie(other.id, "CLIENT"), "content-type": "application/json" }, body: "{}" }); assert.equal(r.status, 409);
});
t("recherche publique : aucune adresse ni donnée privée exposée", async () => {
  const s = (await db.service.findFirstOrThrow({ where: { code: "coupe" } })).id;
  const txt = await (await fetch(`${BASE}/api/search?zip=1200&services=${s}&mode=scheduled`)).text();
  assert.ok(!/street|email|phone|passwordHash|payoutAccountRef/i.test(txt));
});
t("session révoquée : le jeton ne fonctionne plus (déconnexion à distance)", async () => {
  const ck = await cookie(client, "CLIENT"); assert.equal((await get("/compte", ck)).status, 200);
  await db.session.update({ where: { id: sidOf(ck) }, data: { revokedAt: new Date() } });
  const page = await fetch(BASE + "/compte", { redirect: "manual", headers: { cookie: ck } }); assert.ok(page.status === 307 || page.status === 302); // …mais la page refuse (redirection connexion)
});
t("jeton sans session en base (ancien format) : refusé", async () => {
  const forged = `gb_session=${await signSession({ uid: client, role: "CLIENT", mfa: true })}`; const r = await fetch(BASE + "/compte", { redirect: "manual", headers: { cookie: forged } }); assert.equal(r.status, 307);
});
t("en-têtes de sécurité : CSP avec nonce, pas d'inline script non signé, anti-clickjacking", async () => {
  const r = await fetch(BASE + "/connexion"); const csp = r.headers.get("content-security-policy") ?? "";
  assert.match(csp, /script-src[^;]*'nonce-/); assert.match(csp, /frame-ancestors 'none'/); assert.match(csp, /object-src 'none'/); assert.equal(r.headers.get("x-frame-options"), "DENY"); assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});
t("CSRF : requête d'une autre origine refusée sur les routes sensibles", async () => {
  const ck = await cookie(client, "CLIENT");
  const r = await fetch(BASE + "/api/bookings", { method: "POST", headers: { cookie: ck, origin: "https://evil.example", "content-type": "application/json" }, body: "{}" }); assert.equal(r.status, 403);
});
test("fermeture", async () => { await db.$disconnect(); });
