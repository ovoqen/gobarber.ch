process.env.DATABASE_URL = "file:./test.db";
import test, { before } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { DateTime } from "luxon";
import { StripeProvider, DemoProvider, setProviderForTests, signWebhook, verifyWebhook } from "../src/modules/payments/provider";

// Stripe simulé : aucun appel réseau réel.
type Call = { url: string; body: URLSearchParams; headers: Record<string, string> };
const calls: Call[] = [];
const realFetch = globalThis.fetch;
function mockStripe(responses: Record<string, unknown>) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const path = String(url).replace("https://api.stripe.com/v1", "");
    calls.push({ url: path, body: new URLSearchParams(String(init.body ?? "")), headers: Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>)) });
    const key = Object.keys(responses).find((k) => path.startsWith(k)); if (!key) return new Response(JSON.stringify({ error: { message: "inconnu" } }), { status: 404 });
    return new Response(JSON.stringify(responses[key]), { status: 200 });
  }) as typeof fetch;
}

let db: typeof import("../src/lib/db").db, svc: typeof import("../src/lib/booking-service");
let clientA: string, partnerOnline: string, partnerOnsite: string, serviceId: string;
const addr = { street: "Rue du Test 1", zip: "1200", city: "Genève" };
const mon = (plus: number) => DateTime.now().setZone("Europe/Zurich").plus({ weeks: 3 }).startOf("week").plus({ days: plus }).set({ hour: 10 }).toJSDate();

before(async () => {
  process.env.PAYMENT_PROVIDER = "demo";
  execSync("npx prisma db push --skip-generate --accept-data-loss", { env: process.env, stdio: "ignore" });
  ({ db } = await import("../src/lib/db")); svc = await import("../src/lib/booking-service");
  for (const t of ["booking", "payout", "partnerService", "partnerZone", "availabilityRule", "timeOff", "partner", "service", "user", "paymentEvent", "setting", "outbox", "notification", "auditLog"] as const) await (db[t] as any).deleteMany();
  const mk = (email: string, role: string) => db.user.create({ data: { email, passwordHash: "x", role, firstName: "T", lastName: email } });
  clientA = (await mk("pc@t.ch", "CLIENT")).id; serviceId = (await db.service.create({ data: { code: "cut", name: "Coupe", durationMin: 30, priceCents: 4000 } })).id;
  const mkP = async (email: string, online: boolean) => {
    const u = await mk(email, "PARTNER");
    const p = await db.partner.create({ data: { userId: u.id, displayName: email, status: "APPROVED", onlinePaymentEnabled: online, payoutAccountRef: "acct_123", stripeStatus: "complete", travelBufferMin: 20 } });
    await db.partnerZone.create({ data: { partnerId: p.id, zip: "1200", city: "Genève", travelFeeCents: 1000 } });
    await db.partnerService.create({ data: { partnerId: p.id, serviceId, priceCents: 4500, durationMin: 30 } });
    for (let d = 1; d <= 7; d++) await db.availabilityRule.create({ data: { partnerId: p.id, weekday: d, startMin: 8 * 60, endMin: 20 * 60 } });
    return p.id;
  };
  partnerOnline = await mkP("on@t.ch", true); partnerOnsite = await mkP("off@t.ch", false);
});

test("Stripe : requête PaymentIntent (CHF, capture manuelle, clé d'idempotence, métadonnées)", async () => {
  mockStripe({ "/payment_intents": { id: "pi_1", client_secret: "pi_1_secret_x" } });
  const p = new StripeProvider("sk_test_x", "manual"); const it = await p.createIntent({ amountCents: 5500, idempotencyKey: "bk-1", bookingId: "b1", description: "d" });
  assert.deepEqual(it, { id: "pi_1", clientSecret: "pi_1_secret_x" });
  const c = calls.at(-1)!; assert.equal(c.url, "/payment_intents"); assert.equal(c.body.get("amount"), "5500"); assert.equal(c.body.get("currency"), "chf"); assert.equal(c.body.get("capture_method"), "manual"); assert.equal(c.body.get("metadata[bookingId]"), "b1");
  assert.equal(c.headers["idempotency-key"], "bk-1"); assert.equal(c.headers.authorization, "Bearer sk_test_x");
  assert.equal(c.body.get("card"), null); // jamais de données de carte côté serveur
  globalThis.fetch = realFetch;
});
test("Stripe : capture, annulation, remboursement, transfert vers le compte du barbier", async () => {
  mockStripe({ "/payment_intents/pi_9/capture": { id: "pi_9" }, "/payment_intents/pi_9/cancel": { id: "pi_9" }, "/refunds": { id: "re_1" }, "/transfers": { id: "tr_1" } });
  const p = new StripeProvider("sk_test_x"); await p.capture("pi_9", 5500); await p.release("pi_9"); await p.refund("pi_9", 1200);
  assert.equal(await p.transfer({ amountCents: 4400, destination: "acct_123", idempotencyKey: "k", description: "x" }), "tr_1");
  assert.equal(calls.find((c) => c.url === "/payment_intents/pi_9/capture")!.body.get("amount_to_capture"), "5500");
  assert.equal(calls.find((c) => c.url === "/refunds")!.body.get("amount"), "1200");
  const t = calls.find((c) => c.url === "/transfers")!; assert.equal(t.body.get("destination"), "acct_123"); assert.equal(t.body.get("currency"), "chf");
  mockStripe({}); await assert.rejects(new StripeProvider("k").capture("x", 1), /Stripe/); // erreur Stripe → exception, jamais silencieuse
  globalThis.fetch = realFetch;
});
test("webhook Stripe : signature valide / falsifiée / expirée / plusieurs signatures", () => {
  const body = '{"id":"evt_1"}', sec = "whsec_x", good = signWebhook(body, sec);
  assert.ok(verifyWebhook(body, good, sec)); assert.ok(!verifyWebhook(body + "x", good, sec)); assert.ok(!verifyWebhook(body, signWebhook(body, sec, 1000), sec));
  assert.ok(verifyWebhook(body, good + ",v1=deadbeef", sec)); assert.ok(!verifyWebhook(body, "t=1,v0=abc", sec));
});

test("paiement Stripe (simulé) : intent → webhook « réservé » → demande envoyée ; rejeu ignoré ; acceptation = capture", async () => {
  const stripe = new StripeProvider("sk_test_x", "manual"); setProviderForTests(stripe); process.env.PAYMENT_PROVIDER = "stripe"; process.env.STRIPE_SECRET_KEY = "sk_test_x"; process.env.STRIPE_WEBHOOK_SECRET = "w"; process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_x";
  mockStripe({ "/payment_intents/pi_77/capture": { id: "pi_77" }, "/payment_intents": { id: "pi_77", client_secret: "sec" } });
  const b = await svc.createBooking({ clientId: clientA, partnerId: partnerOnline, serviceIds: [serviceId], mode: "SCHEDULED", startsAt: mon(1), address: addr });
  assert.equal(b.paymentMode, "ONLINE"); assert.equal(b.status, "PENDING_PAYMENT");
  const st = await svc.startPayment(b.id, clientA); assert.equal(st.kind, "intent");
  assert.equal((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status, "PENDING_PAYMENT"); // pas de demande tant que Stripe n'a pas confirmé
  const ev = { id: "evt_a", type: "payment_intent.amount_capturable_updated", data: { object: { id: "pi_77", metadata: { bookingId: b.id } } } };
  assert.equal(await svc.handleStripeEvent(ev), "processed"); assert.equal(await svc.handleStripeEvent(ev), "duplicate");
  const after = await db.booking.findUniqueOrThrow({ where: { id: b.id }, include: { payments: true } }); assert.equal(after.status, "REQUESTED"); assert.equal(after.payments[0].status, "AUTHORIZED");
  const partner = await db.partner.findUniqueOrThrow({ where: { id: partnerOnline } });
  await svc.partnerRespond(b.id, partner.id, true);
  assert.ok(calls.some((c) => c.url === "/payment_intents/pi_77/capture")); assert.equal((await db.payment.findFirstOrThrow({ where: { bookingId: b.id } })).status, "CAPTURED");
  setProviderForTests(null); process.env.PAYMENT_PROVIDER = "demo"; globalThis.fetch = realFetch;
});
test("mode automatique (TWINT) : encaissé tout de suite, refus du barbier = remboursement intégral", async () => {
  const stripe = new StripeProvider("sk_test_x", "automatic"); setProviderForTests(stripe); process.env.PAYMENT_PROVIDER = "stripe"; process.env.STRIPE_SECRET_KEY = "sk_test_x"; process.env.STRIPE_WEBHOOK_SECRET = "w"; process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_x";
  mockStripe({ "/refunds": { id: "re_9" }, "/payment_intents": { id: "pi_88", client_secret: "sec" } });
  const b = await svc.createBooking({ clientId: clientA, partnerId: partnerOnline, serviceIds: [serviceId], mode: "SCHEDULED", startsAt: mon(2), address: addr });
  await svc.startPayment(b.id, clientA);
  await svc.handleStripeEvent({ id: "evt_b", type: "payment_intent.succeeded", data: { object: { id: "pi_88", metadata: { bookingId: b.id } } } });
  assert.equal((await db.payment.findFirstOrThrow({ where: { bookingId: b.id } })).status, "CAPTURED");
  await svc.partnerRespond(b.id, partnerOnline, false);
  assert.ok(calls.some((c) => c.url === "/refunds" && c.body.get("amount") === String(b.totalCents)));
  const p = await db.payment.findFirstOrThrow({ where: { bookingId: b.id } }); assert.equal(p.status, "REFUNDED"); assert.equal(p.refundedCents, b.totalCents);
  setProviderForTests(null); process.env.PAYMENT_PROVIDER = "demo"; globalThis.fetch = realFetch;
});
test("barbier réglé sur place : aucune commission, aucun paiement en ligne, demande envoyée tout de suite, jamais de versement", async () => {
  setProviderForTests(new DemoProvider());
  const b = await svc.createBooking({ clientId: clientA, partnerId: partnerOnsite, serviceIds: [serviceId], mode: "SCHEDULED", startsAt: mon(3), address: addr });
  assert.equal(b.paymentMode, "ON_SITE"); assert.equal(b.status, "REQUESTED"); assert.equal(b.commissionCents, 0); assert.ok(b.responseDeadline);
  assert.equal(await db.payment.count({ where: { bookingId: b.id } }), 0);
  await assert.rejects(svc.startPayment(b.id, clientA), svc.BookingError);
  await svc.partnerRespond(b.id, partnerOnsite, true); assert.equal((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status, "ACCEPTED");
  const c = await svc.cancelBooking(b.id, "CLIENT", clientA); assert.equal(c.chargeCents, 0);
  await db.booking.update({ where: { id: b.id }, data: { status: "COMPLETED", completedAt: new Date(Date.now() - 72 * 3600_000), partnerNetCents: 4500 } });
  const n = await db.payout.count(); await svc.runPayouts("admin"); assert.equal(await db.payout.count(), n);
});
test("barbier activé en ligne mais Stripe non configuré sur le serveur : repli sur paiement sur place (jamais de paiement fantôme)", async () => {
  process.env.PAYMENT_PROVIDER = "stripe"; delete process.env.STRIPE_WEBHOOK_SECRET; setProviderForTests(new DemoProvider());
  const b = await svc.createBooking({ clientId: clientA, partnerId: partnerOnline, serviceIds: [serviceId], mode: "SCHEDULED", startsAt: mon(4), address: addr });
  assert.equal(b.paymentMode, "ON_SITE"); process.env.PAYMENT_PROVIDER = "demo"; setProviderForTests(null);
});
test("versement Stripe : transfert unique vers le compte relié, pas de doublon à la relance", async () => {
  calls.length = 0; mockStripe({ "/transfers": { id: "tr_55" } });
  setProviderForTests(new StripeProvider("sk_test_x")); process.env.PAYMENT_PROVIDER = "stripe";
  const t = mon(5); const b = await db.booking.create({ data: { number: "GB-X-1", clientId: clientA, partnerId: partnerOnline, mode: "SCHEDULED", status: "COMPLETED", startsAt: t, endsAt: new Date(t.getTime() + 1800_000), street: "x", zip: "1200", city: "Genève", subtotalCents: 4500, travelFeeCents: 1000, totalCents: 5500, commissionBps: 2000, commissionCents: 900, partnerNetCents: 4600, completedAt: new Date(Date.now() - 72 * 3600_000), paymentMode: "ONLINE" } });
  assert.equal(await svc.runPayouts("admin"), 1);
  const tr = calls.filter((c) => c.url === "/transfers"); assert.equal(tr.length, 1); assert.equal(tr[0].body.get("amount"), "4600"); assert.equal(tr[0].body.get("destination"), "acct_123");
  assert.equal((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).payoutId !== null, true);
  assert.equal(await svc.runPayouts("admin"), 0); // déjà versé
  // inscription Stripe incomplète → pas de versement
  await db.partner.update({ where: { id: partnerOnline }, data: { stripeStatus: "pending" } });
  await db.booking.create({ data: { number: "GB-X-2", clientId: clientA, partnerId: partnerOnline, mode: "SCHEDULED", status: "COMPLETED", startsAt: t, endsAt: t, street: "x", zip: "1200", city: "Genève", subtotalCents: 1, travelFeeCents: 0, totalCents: 1, commissionBps: 0, commissionCents: 0, partnerNetCents: 100, completedAt: new Date(Date.now() - 72 * 3600_000), paymentMode: "ONLINE" } });
  assert.equal(await svc.runPayouts("admin"), 0);
  setProviderForTests(null); process.env.PAYMENT_PROVIDER = "demo"; globalThis.fetch = realFetch;
});
