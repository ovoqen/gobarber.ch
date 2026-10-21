import test from "node:test";
import assert from "node:assert/strict";
import { computeTotals } from "../src/modules/pricing";
import { computeCancellation } from "../src/modules/cancellation";
import { canTransition } from "../src/modules/booking-state";
import { freeSlots, isSlotFree } from "../src/modules/slots";
import { newSecret, totpAt, verifyTotp } from "../src/modules/totp";
import { signWebhook, verifyWebhook, DemoProvider } from "../src/modules/payments/provider";
import { DateTime } from "luxon";

test("pricing: commission sur prestations après remise, déplacement intégral au barbier", () => {
  const t = computeTotals([4500, 2500], 800, 2000, { percentOff: 10 });
  assert.equal(t.subtotalCents, 7000); assert.equal(t.discountCents, 700);
  assert.equal(t.totalCents, 6300 + 800); assert.equal(t.commissionCents, 1260);
  assert.equal(t.partnerNetCents, t.totalCents - 1260);
});
test("pricing: remise plafonnée, montants invalides refusés", () => {
  assert.equal(computeTotals([1000], 0, 2000, { amountOffCents: 5000 }).totalCents, 0);
  assert.throws(() => computeTotals([10.5], 0, 2000));
  assert.throws(() => computeTotals([100], 0, 20000));
});
const base = { totalCents: 7000, travelFeeCents: 800 };
const now = new Date("2026-11-01T10:00:00Z");
const h = (n: number) => new Date(now.getTime() + n * 3_600_000);
test("annulation client: gratuit >24h, 50% entre 2h et 24h, 100% <2h", () => {
  assert.equal(computeCancellation({ ...base, by: "CLIENT", status: "ACCEPTED", startsAt: h(48), acceptedAt: h(-5), now }).chargeCents, 0);
  assert.equal(computeCancellation({ ...base, by: "CLIENT", status: "ACCEPTED", startsAt: h(10), acceptedAt: h(-5), now }).chargeCents, 3500);
  assert.equal(computeCancellation({ ...base, by: "CLIENT", status: "ACCEPTED", startsAt: h(1), acceptedAt: h(-5), now }).refundCents, 0);
});
test("annulation: demande non acceptée, barbier, délai de grâce", () => {
  assert.equal(computeCancellation({ ...base, by: "CLIENT", status: "REQUESTED", startsAt: h(1), now }).refundCents, 7000);
  const p = computeCancellation({ ...base, by: "PARTNER", status: "ACCEPTED", startsAt: h(1), now });
  assert.equal(p.refundCents, 7000); assert.equal(p.flagPartner, true);
  assert.equal(computeCancellation({ ...base, by: "CLIENT", status: "ACCEPTED", startsAt: h(1), acceptedAt: new Date(now.getTime() - 120_000), now }).chargeCents, 0);
  assert.equal(computeCancellation({ ...base, by: "CLIENT", status: "EN_ROUTE", startsAt: h(0.2), acceptedAt: h(-3), now }).chargeCents, 7000);
});
test("états: transitions valides uniquement", () => {
  assert.ok(canTransition("REQUESTED", "ACCEPTED")); assert.ok(canTransition("IN_PROGRESS", "COMPLETED"));
  assert.ok(!canTransition("COMPLETED", "CANCELLED")); assert.ok(!canTransition("REQUESTED", "COMPLETED")); assert.ok(!canTransition("REFUSED", "ACCEPTED"));
});
const z = (s: string) => DateTime.fromISO(s, { zone: "Europe/Zurich" }).toJSDate();
test("créneaux: trajet inclus, congés et rendez-vous exclus, lead time", () => {
  const rules = [{ weekday: 1, startMin: 9 * 60, endMin: 18 * 60 }]; // lundi 2026-11-02
  const slots = freeSlots({ rules, timeOff: [{ start: z("2026-11-02T12:00"), end: z("2026-11-02T13:00") }],
    booked: [{ start: z("2026-11-02T10:00"), end: z("2026-11-02T11:00") }], durationMin: 45, travelBufferMin: 20,
    from: z("2026-11-02T00:00"), days: 1, now: z("2026-11-01T08:00"), stepMin: 15 });
  const hhmm = slots.map((d) => DateTime.fromJSDate(d, { zone: "Europe/Zurich" }).toFormat("HH:mm"));
  assert.ok(!hhmm.includes("09:00") && !hhmm.includes("09:30")); // 09:00–09:45 chevauche 10:00 − 20 min de trajet
  assert.ok(!hhmm.includes("11:15") && !hhmm.includes("11:30")); // 11:00 + 20 min de trajet ; 11:30–12:15 chevauche le congé
  assert.ok(hhmm.includes("11:45") === false && hhmm.includes("13:00")); // 11:45–12:30 chevauche le congé ; 13:00 libre
});
test("créneaux: heure passée / lead time exclus", () => {
  const s = freeSlots({ rules: [{ weekday: 1, startMin: 540, endMin: 1080 }], timeOff: [], booked: [], durationMin: 30, travelBufferMin: 0,
    from: z("2026-11-02T00:00"), days: 1, now: z("2026-11-02T10:00"), leadMin: 60 });
  assert.equal(DateTime.fromJSDate(s[0], { zone: "Europe/Zurich" }).toFormat("HH:mm"), "11:00");
});
test("isSlotFree: deux réservations qui se touchent sans trajet sont refusées", () => {
  const b = [{ start: z("2026-11-02T10:00"), end: z("2026-11-02T11:00") }];
  assert.equal(isSlotFree(z("2026-11-02T11:00"), z("2026-11-02T12:00"), b, [], 20), false);
  assert.equal(isSlotFree(z("2026-11-02T11:20"), z("2026-11-02T12:00"), b, [], 20), true);
});
test("TOTP: vecteur RFC 6238 et vérification", () => {
  assert.equal(totpAt("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000, 30, 8), "94287082");
  const s = newSecret(); assert.ok(verifyTotp(s, totpAt(s))); assert.ok(!verifyTotp(s, "000000") || totpAt(s) === "000000");
});
test("webhook: signature valide, falsifiée, expirée", () => {
  const body = '{"id":"evt_1"}', sec = "s3cret";
  assert.ok(verifyWebhook(body, signWebhook(body, sec), sec));
  assert.ok(!verifyWebhook(body + " ", signWebhook(body, sec), sec));
  assert.ok(!verifyWebhook(body, signWebhook(body, sec, 1000), sec));
  assert.ok(!verifyWebhook(body, null, sec));
});
test("paiement démo: idempotence", async () => {
  const p = new DemoProvider();
  const a = await p.authorize({ amountCents: 100, idempotencyKey: "k" }), b = await p.authorize({ amountCents: 100, idempotencyKey: "k" });
  assert.ok(a.ok && b.ok && a.ref === b.ref);
});

import { minPeople, overlapsPair } from "../src/modules/people";
test("personnes : coupe + barbe inclut déjà les deux ; le reste = autres personnes", () => {
  assert.ok(overlapsPair("coupe-barbe", "barbe") && overlapsPair("coupe", "coupe-barbe") && !overlapsPair("coupe", "barbe"));
  assert.equal(minPeople([{ code: "coupe-barbe", qty: 1 }]), 1);
  assert.equal(minPeople([{ code: "coupe-barbe", qty: 1 }, { code: "barbe", qty: 1 }]), 2);          // barbe en plus = une autre personne
  assert.equal(minPeople([{ code: "coupe-barbe", qty: 2 }, { code: "coupe", qty: 1 }]), 3);
  assert.equal(minPeople([{ code: "coupe", qty: 1 }, { code: "barbe", qty: 1 }]), 1);                  // sans formule : même personne possible
  assert.equal(minPeople([{ code: "coupe", qty: 2 }, { code: "barbe", qty: 1 }]), 2);
  assert.equal(minPeople([{ code: "coupe-barbe", qty: 1 }, { code: "coupe-enfant", qty: 1 }]), 2);    // enfant = une personne de plus
});
