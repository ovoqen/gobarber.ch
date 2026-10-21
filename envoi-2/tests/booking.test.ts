process.env.DATABASE_URL = "file:./test.db";
import test, { before } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { DateTime } from "luxon";

let db: typeof import("../src/lib/db").db, svc: typeof import("../src/lib/booking-service");
let clientA: string, clientB: string, partnerId: string, serviceId: string, partnerUser: string;

const nextMonday10 = () => DateTime.now().setZone("Europe/Zurich").plus({ weeks: 2 }).startOf("week").set({ hour: 10 }).toJSDate();
const addr = { street: "Rue du Test 1", zip: "1200", city: "Genève" };

before(async () => {
  execSync("npx prisma db push --skip-generate --accept-data-loss", { env: process.env, stdio: "ignore" });
  ({ db } = await import("../src/lib/db")); svc = await import("../src/lib/booking-service");
  for (const t of ["booking", "payout", "partnerService", "partnerZone", "availabilityRule", "timeOff", "partner", "service", "user", "promoCode", "setting", "outbox", "notification", "paymentEvent", "auditLog"] as const) await (db[t] as any).deleteMany();
  const mk = (email: string, role: string) => db.user.create({ data: { email, passwordHash: "x", role, firstName: "T", lastName: email } });
  clientA = (await mk("a@t.ch", "CLIENT")).id; clientB = (await mk("b@t.ch", "CLIENT")).id; partnerUser = (await mk("p@t.ch", "PARTNER")).id;
  serviceId = (await db.service.create({ data: { code: "cut", name: "Coupe", durationMin: 30, priceCents: 4000 } })).id;
  const p = await db.partner.create({ data: { userId: partnerUser, displayName: "Barbier Test", status: "APPROVED", onlinePaymentEnabled: true, instantEnabled: true, payoutAccountRef: "acct_demo", travelBufferMin: 20 } });
  partnerId = p.id;
  await db.partnerZone.create({ data: { partnerId, zip: "1200", city: "Genève", travelFeeCents: 500 } });
  await db.partnerService.create({ data: { partnerId, serviceId, priceCents: 4500, durationMin: 30 } });
  for (let d = 1; d <= 7; d++) await db.availabilityRule.create({ data: { partnerId, weekday: d, startMin: 8 * 60, endMin: 20 * 60 } });
});
const book = (clientId: string, startsAt: Date, extra = {}) => svc.createBooking({ clientId, partnerId, serviceIds: [serviceId], mode: "SCHEDULED", startsAt, address: addr, ...extra });

test("réservations simultanées : un seul gagnant sur le même créneau", async () => {
  const t = nextMonday10();
  const res = await Promise.allSettled([book(clientA, t), book(clientB, t), book(clientA, t)]);
  assert.equal(res.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(res.filter((r) => r.status === "rejected").every((r: any) => r.reason instanceof svc.BookingError));
});
test("temps de trajet : un créneau collé au précédent est refusé, avec 20 min d'écart accepté", async () => {
  const t = DateTime.fromJSDate(nextMonday10()).plus({ days: 1 }).toJSDate();
  await book(clientA, t);
  await assert.rejects(book(clientB, new Date(t.getTime() + 30 * 60_000)), svc.BookingError); // 10:30 : trajet impossible
  await book(clientB, new Date(t.getTime() + 50 * 60_000)); // 10:50
});
test("paiement : autorisation, double clic idempotent, échec réessayable", async () => {
  const t = DateTime.fromJSDate(nextMonday10()).plus({ days: 2 }).toJSDate();
  const b = await book(clientA, t);
  await assert.rejects(svc.payBooking(b.id, clientA, true), /refusé/);
  assert.equal((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status, "PENDING_PAYMENT");
  const [x, y] = await Promise.all([svc.payBooking(b.id, clientA), svc.payBooking(b.id, clientA)]);
  assert.equal(x.status, "REQUESTED"); assert.equal(y.status, "REQUESTED");
  assert.equal(await db.payment.count({ where: { bookingId: b.id, status: "AUTHORIZED" } }), 1);
  await assert.rejects(svc.payBooking(b.id, clientB), svc.BookingError); // pas le sien
});
test("refus du barbier : autorisation libérée, créneau de nouveau libre", async () => {
  const t = DateTime.fromJSDate(nextMonday10()).plus({ days: 3 }).toJSDate();
  const b = await book(clientA, t); await svc.payBooking(b.id, clientA);
  await svc.partnerRespond(b.id, partnerId, false);
  const after = await db.booking.findUniqueOrThrow({ where: { id: b.id }, include: { payments: true } });
  assert.equal(after.status, "REFUSED"); assert.equal(after.payments[0].status, "RELEASED");
  await book(clientB, t);
});
test("barbier sans réponse : expiration + libération", async () => {
  const t = DateTime.fromJSDate(nextMonday10()).plus({ days: 4 }).toJSDate();
  const b = await book(clientA, t); await svc.payBooking(b.id, clientA);
  await db.booking.update({ where: { id: b.id }, data: { responseDeadline: new Date(Date.now() - 1000) } });
  await svc.expireStale();
  assert.equal((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status, "EXPIRED");
  await assert.rejects(svc.partnerRespond(b.id, partnerId, true), svc.BookingError);
});
test("cycle complet, annulation tardive, remboursement et versement", async () => {
  const t = DateTime.fromJSDate(nextMonday10()).plus({ days: 5 }).toJSDate();
  const b = await book(clientA, t); await svc.payBooking(b.id, clientA);
  await svc.partnerRespond(b.id, partnerId, true);
  assert.equal((await db.payment.findFirstOrThrow({ where: { bookingId: b.id } })).status, "CAPTURED");
  await assert.rejects(svc.advance(b.id, partnerId, "COMPLETED"), svc.BookingError); // saut d'étape interdit
  // Annulation du client > 24 h avant : remboursement intégral
  const out = await svc.cancelBooking(b.id, "CLIENT", clientA);
  assert.equal(out.refundCents, b.totalCents);
  assert.equal((await db.payment.findFirstOrThrow({ where: { bookingId: b.id } })).status, "REFUNDED");
  await assert.rejects(svc.cancelBooking(b.id, "CLIENT", clientA), svc.BookingError);
  // Prestation menée à terme (créneau dans la semaine suivante) puis versement
  const b2 = await book(clientB, DateTime.fromJSDate(t).plus({ days: 1 }).toJSDate()); await svc.payBooking(b2.id, clientB); await svc.partnerRespond(b2.id, partnerId, true);
  await db.booking.update({ where: { id: b2.id }, data: { startsAt: new Date(Date.now() + 3600_000) } });
  for (const s of ["EN_ROUTE", "IN_PROGRESS", "COMPLETED"] as const) await svc.advance(b2.id, partnerId, s);
  await db.booking.update({ where: { id: b2.id }, data: { completedAt: new Date(Date.now() - 48 * 3600_000) } });
  assert.equal(await svc.runPayouts("admin"), 1);
  const p = await db.payout.findFirstOrThrow(); const done = await db.booking.findUniqueOrThrow({ where: { id: b2.id } });
  assert.equal(p.amountCents, done.partnerNetCents); assert.equal(await svc.runPayouts("admin"), 0); // pas de double versement
});
test("webhook : événement rejoué ignoré", async () => {
  assert.equal(await svc.confirmPaymentEvent("evt_1", "payment.failed"), "processed");
  assert.equal(await svc.confirmPaymentEvent("evt_1", "payment.failed"), "duplicate");
});
test("zone non desservie / service non proposé refusés", async () => {
  const t = DateTime.fromJSDate(nextMonday10()).plus({ days: 6 }).toJSDate();
  await assert.rejects(svc.createBooking({ clientId: clientA, partnerId, serviceIds: [serviceId], mode: "SCHEDULED", startsAt: t, address: { ...addr, zip: "8000" } }), svc.BookingError);
  await assert.rejects(svc.createBooking({ clientId: clientA, partnerId, serviceIds: ["nope"], mode: "SCHEDULED", startsAt: t, address: addr }), svc.BookingError);
});

test("suppression de compte : refusée avec réservation en cours, puis anonymisation", async () => {
  const { deleteAccountData } = await import("../src/lib/account");
  const u = await db.user.create({ data: { email: "del@t.ch", passwordHash: "x", firstName: "Del", lastName: "Ete", phone: "+41790000000" } });
  await db.address.create({ data: { userId: u.id, street: "Rue Secrète 5", zip: "1200", city: "Genève" } });
  const t = DateTime.fromJSDate(nextMonday10()).plus({ days: 9 }).toJSDate();
  const b = await book(u.id, t); await svc.payBooking(b.id, u.id);
  const refused = await deleteAccountData(u.id); assert.equal(refused.ok, false);
  await svc.cancelBooking(b.id, "CLIENT", u.id);
  assert.equal((await deleteAccountData(u.id)).ok, true);
  const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
  assert.ok(after.email.endsWith("@deleted.invalid") && after.deletedAt && !after.active && after.phone === null && after.firstName === "Compte");
  assert.equal(await db.address.count({ where: { userId: u.id } }), 0);
  const bk = await db.booking.findUniqueOrThrow({ where: { id: b.id } }); assert.equal(bk.street, "—"); // la pièce comptable reste, sans adresse
});

test("calendrier : ajout manuel, conflit refusé, déplacement, annulation sans paiement, aucun versement", async () => {
  const t = DateTime.fromJSDate(nextMonday10()).plus({ days: 12 }).set({ hour: 14 }).toJSDate();
  const m = await svc.createManualBooking({ actorId: partnerUser, partnerId, serviceIds: [serviceId], startsAt: t, guestName: "Client téléphone", guestPhone: "+41790000001", address: addr });
  assert.equal(m.status, "ACCEPTED"); assert.equal(m.source, "MANUAL"); assert.equal(m.commissionCents, 0);
  assert.equal(await db.payment.count({ where: { bookingId: m.id } }), 0);
  const guest = await db.user.findUniqueOrThrow({ where: { id: m.clientId } }); assert.ok(guest.email.endsWith("@gobarber.invalid"));
  // même créneau / créneau collé (trajet) : refusé, y compris pour une réservation en ligne
  await assert.rejects(svc.createManualBooking({ actorId: partnerUser, partnerId, serviceIds: [serviceId], startsAt: t, guestName: "X", address: addr }), svc.BookingError);
  await assert.rejects(book(clientA, new Date(t.getTime() + 30 * 60_000)), svc.BookingError);
  // déplacement : libre OK, sur un rendez-vous existant refusé, mauvais barbier refusé
  const t2 = new Date(t.getTime() + 3 * 3600_000);
  await svc.rescheduleBooking(m.id, t2, partnerUser, partnerId);
  assert.equal((await db.booking.findUniqueOrThrow({ where: { id: m.id } })).startsAt.getTime(), t2.getTime());
  const other = await svc.createManualBooking({ actorId: partnerUser, partnerId, serviceIds: [serviceId], startsAt: t, guestName: "Y", address: addr });
  await assert.rejects(svc.rescheduleBooking(other.id, t2, partnerUser, partnerId), svc.BookingError);
  await assert.rejects(svc.rescheduleBooking(other.id, t, partnerUser, "autre-barbier"), svc.BookingError);
  // annulation : horodatée, pas de paiement à rembourser
  await svc.cancelBooking(other.id, "ADMIN", partnerUser, "Test");
  const c = await db.booking.findUniqueOrThrow({ where: { id: other.id } }); assert.equal(c.status, "CANCELLED"); assert.ok(c.cancelledAt);
  // jamais de versement pour un rendez-vous payé hors plateforme
  await db.booking.update({ where: { id: m.id }, data: { status: "COMPLETED", completedAt: new Date(Date.now() - 72 * 3600_000), partnerNetCents: 4500 } });
  const before = await db.payout.count(); await svc.runPayouts("admin"); assert.equal(await db.payout.count(), before);
});
test("annulation par le client : horodatée et comptabilisée dans l'historique", async () => {
  const t = DateTime.fromJSDate(nextMonday10()).plus({ days: 15 }).toJSDate();
  const b = await book(clientB, t); await svc.payBooking(b.id, clientB); await svc.cancelBooking(b.id, "CLIENT", clientB);
  const x = await db.booking.findUniqueOrThrow({ where: { id: b.id } }); assert.equal(x.cancelledBy, "CLIENT"); assert.ok(x.cancelledAt);
  assert.ok((await db.booking.count({ where: { clientId: clientB, cancelledBy: "CLIENT", status: "CANCELLED" } })) >= 1);
});

test("plusieurs personnes : quantité par prestation, durée et prix multipliés, déplacement une seule fois", async () => {
  const t = DateTime.fromJSDate(nextMonday10()).plus({ days: 18 }).toJSDate();
  const b = await svc.createBooking({ clientId: clientA, partnerId, serviceIds: [serviceId], quantities: { [serviceId]: 2 }, people: 3, mode: "SCHEDULED", startsAt: t, address: addr });
  assert.equal(b.people, 3);
  assert.equal(b.subtotalCents, 2 * 4500); assert.equal(b.travelFeeCents, 500); assert.equal(b.totalCents, 9500);
  assert.equal(b.endsAt.getTime() - b.startsAt.getTime(), 60 * 60_000); // 2 × 30 min
  const it = await db.bookingItem.findFirstOrThrow({ where: { bookingId: b.id } }); assert.equal(it.quantity, 2); assert.equal(it.priceCents, 4500);
  // le nombre de personnes ne peut pas être inférieur à la quantité demandée ; plafond à 8
  const t2 = new Date(t.getTime() + 6 * 3600_000);
  const c = await svc.createBooking({ clientId: clientA, partnerId, serviceIds: [serviceId], quantities: { [serviceId]: 3 }, people: 1, mode: "SCHEDULED", startsAt: t2, address: addr });
  assert.equal(c.people, 3);
  await assert.rejects(svc.createBooking({ clientId: clientA, partnerId, serviceIds: [serviceId], people: 9, mode: "SCHEDULED", startsAt: new Date(t.getTime() + 9 * 3600_000), address: addr }), svc.BookingError);
});

test("coupe + barbe puis barbe en plus : le serveur impose une autre personne (2 minimum)", async () => {
  const mkS = async (code: string, price: number, dur: number) => { const s = await db.service.create({ data: { code, name: code, durationMin: dur, priceCents: price } }); await db.partnerService.create({ data: { partnerId, serviceId: s.id, priceCents: price, durationMin: dur } }); return s.id; };
  const combo = await mkS("coupe-barbe", 7000, 50), barbe = await mkS("barbe", 3000, 20);
  const t = DateTime.fromJSDate(nextMonday10()).plus({ days: 20 }).toJSDate();
  const b = await svc.createBooking({ clientId: clientA, partnerId, serviceIds: [combo, barbe], people: 1, mode: "SCHEDULED", startsAt: t, address: addr });
  assert.equal(b.people, 2); assert.equal(b.subtotalCents, 10000); assert.equal(b.endsAt.getTime() - b.startsAt.getTime(), 70 * 60_000);
  const solo = await svc.createBooking({ clientId: clientA, partnerId, serviceIds: [combo], people: 1, mode: "SCHEDULED", startsAt: new Date(t.getTime() + 4 * 3600_000), address: addr });
  assert.equal(solo.people, 1);
});
