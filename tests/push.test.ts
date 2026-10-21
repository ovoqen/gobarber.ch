process.env.DATABASE_URL = "file:./test.db";
import test, { before } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";

const realFetch = globalThis.fetch; const sent: { url: string; body: string; auth?: string }[] = [];
let db: typeof import("../src/lib/db").db, push: typeof import("../src/lib/push"), uid: string;
before(async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  process.env.FCM_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: "gb-test", client_email: "svc@gb-test.iam.gserviceaccount.com", private_key: privateKey });
  execSync("npx prisma db push --skip-generate --accept-data-loss", { env: process.env, stdio: "ignore" });
  ({ db } = await import("../src/lib/db")); push = await import("../src/lib/push");
  await db.device.deleteMany(); await db.user.deleteMany({ where: { email: "push@t.ch" } });
  uid = (await db.user.create({ data: { email: "push@t.ch", passwordHash: "x", firstName: "P", lastName: "T" } })).id;
  await db.device.createMany({ data: [{ userId: uid, platform: "ios", token: "tok_ios_valid_aaaaaaaaaaaa" }, { userId: uid, platform: "android", token: "tok_dead_bbbbbbbbbbbbbbbb" }] });
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url: String(url), body: String(init.body ?? ""), auth: (init.headers as Record<string, string>)?.authorization });
    if (String(url).includes("oauth2.googleapis.com")) return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }), { status: 200 });
    if (String(init.body).includes("tok_dead")) return new Response(JSON.stringify({ error: { status: "UNREGISTERED" } }), { status: 404 });
    return new Response(JSON.stringify({ name: "ok" }), { status: 200 });
  }) as typeof fetch;
});
test("push FCM : jeton OAuth signé, message correct, appareil désinstallé supprimé", async () => {
  assert.ok(push.pushConfigured());
  const r = await push.sendPush(uid, "Demande acceptée", "Votre rendez-vous est confirmé.", "/compte/reservations/x");
  assert.equal(r.sent, 1);
  const tok = sent.find((s) => s.url.includes("oauth2")); assert.match(tok!.body, /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer/); assert.match(tok!.body, /assertion=[\w-]+\.[\w-]+\.[\w-]+/);
  const m = sent.find((s) => s.url.includes("fcm.googleapis.com/v1/projects/gb-test/messages:send") && s.body.includes("tok_ios_valid"))!; assert.equal(m.auth, "Bearer ya29.test");
  const msg = JSON.parse(m.body).message; assert.equal(msg.notification.title, "Demande acceptée"); assert.equal(msg.data.href, "/compte/reservations/x"); assert.equal(msg.android.priority, "high");
  assert.equal(await db.device.count({ where: { token: "tok_dead_bbbbbbbbbbbbbbbb" } }), 0); assert.equal(await db.device.count({ where: { token: "tok_ios_valid_aaaaaaaaaaaa" } }), 1);
  globalThis.fetch = realFetch;
});
test("push : non configurée ou sans appareil = aucun envoi, aucune erreur", async () => {
  delete process.env.FCM_SERVICE_ACCOUNT_JSON; assert.equal((await push.sendPush(uid, "a", "b")).sent, 0); assert.equal(push.pushConfigured(), false);
});
