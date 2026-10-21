// Cœur métier des réservations : toutes les écritures sensibles passent ici (et seulement ici).
import { db } from "./db";
import { notify } from "./notify";
import { audit } from "./audit";
import { getSettings, toPolicy } from "./settings";
import { getProvider, paymentsReady } from "@/modules/payments/provider";
import { computeTotals } from "@/modules/pricing";
import { computeCancellation } from "@/modules/cancellation";
import { BLOCKING, HOLD_MINUTES, canTransition } from "@/modules/booking-state";
import { freeSlots, isSlotFree, fmtDateTime, type Interval } from "@/modules/slots";
import { isSwissZip } from "@/modules/zones";
import { minPeople } from "@/modules/people";

export class BookingError extends Error {}
function fail(m: string): never { throw new BookingError(m); }

/** Rendez-vous qui occupent le planning (+ réservations en cours de paiement, retenues 10 min). */
export async function busyIntervals(partnerId: string, from: Date, to: Date, excludeId?: string, client = db): Promise<Interval[]> {
  const hold = new Date(Date.now() - HOLD_MINUTES * 60_000);
  const rows = await client.booking.findMany({
    where: { partnerId, id: excludeId ? { not: excludeId } : undefined, startsAt: { lt: to }, endsAt: { gt: from },
      OR: [{ status: { in: BLOCKING } }, { status: "PENDING_PAYMENT", createdAt: { gt: hold } }] },
    select: { startsAt: true, endsAt: true },
  });
  return rows.map((r) => ({ start: r.startsAt, end: r.endsAt }));
}

export async function partnerOffer(partnerId: string, zip: string, serviceIds: string[]) {
  const p = await db.partner.findUnique({ where: { id: partnerId }, include: { zones: true, services: { include: { service: true } } } });
  if (!p || p.status !== "APPROVED") return null;
  const zone = p.zones.find((z) => z.zip === zip);
  if (!zone) return null;
  const items = serviceIds.map((id) => p.services.find((s) => s.serviceId === id && s.active && s.service.active));
  if (items.some((i) => !i)) return null;
  return { partner: p, zone, items: items as NonNullable<(typeof items)[number]>[] };
}

export async function nextSlots(partnerId: string, durationMin: number, opts: { days?: number; from?: Date; limit?: number; asap?: boolean } = {}) {
  const p = await db.partner.findUnique({ where: { id: partnerId }, include: { availability: true } });
  if (!p) return [];
  const s = await getSettings();
  const now = new Date(), from = opts.from ?? now, days = opts.days ?? 14;
  const to = new Date(from.getTime() + (days + 1) * 86_400_000);
  const [booked, off] = await Promise.all([
    busyIntervals(partnerId, new Date(from.getTime() - 86_400_000), to),
    db.timeOff.findMany({ where: { partnerId, endsAt: { gt: from }, startsAt: { lt: to } } }),
  ]);
  const slots = freeSlots({ rules: p.availability, timeOff: off.map((o) => ({ start: o.startsAt, end: o.endsAt })), booked, durationMin,
    travelBufferMin: p.travelBufferMin, from, days, now, leadMin: opts.asap ? p.travelBufferMin + 15 : Number(s.minLeadMinutes), stepMin: opts.asap ? 15 : 30 });
  return slots.slice(0, opts.limit ?? 200);
}

const newNumber = () => `GB-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

export const MAX_QTY = 6, MAX_PEOPLE = 8;
const qtyOf = (q: Record<string, number> | undefined, id: string) => { const n = Math.floor(Number(q?.[id] ?? 1)); return Number.isFinite(n) ? Math.min(MAX_QTY, Math.max(1, n)) : 1; };

export type CreateInput = {
  quantities?: Record<string, number>; people?: number;
  clientId: string; partnerId: string; serviceIds: string[]; mode: "ASAP" | "SCHEDULED"; startsAt?: Date;
  address: { street: string; zip: string; city: string; access?: string | null; lat?: number | null; lng?: number | null }; promoCode?: string | null;
};

export async function createBooking(inp: CreateInput) {
  if (!isSwissZip(inp.address.zip)) fail("Code postal suisse invalide.");
  if (!inp.address.street.trim() || !inp.address.city.trim()) fail("Adresse incomplète.");
  if (!inp.serviceIds.length) fail("Choisissez au moins une prestation.");
  const offer = (await partnerOffer(inp.partnerId, inp.address.zip, inp.serviceIds)) ?? fail("Ce barbier ne propose pas cette prestation à cette adresse.");
  const settings = await getSettings();
  const qty = (id: string) => qtyOf(inp.quantities, id);
  const durationMin = offer.items.reduce((a, i) => a + i.durationMin * qty(i.serviceId), 0);
  const people = Math.max(minPeople(offer.items.map((i) => ({ code: i.service.code, qty: qty(i.serviceId) }))), Math.floor(inp.people ?? 1));
  if (people > MAX_PEOPLE) fail(`Maximum ${MAX_PEOPLE} personnes par rendez-vous : faites plusieurs réservations.`);
  const now = new Date();

  let startsAt = inp.startsAt;
  if (inp.mode === "ASAP") {
    if (!offer.partner.instantEnabled) fail("Ce barbier n'accepte pas les demandes immédiates.");
    startsAt = (await nextSlots(inp.partnerId, durationMin, { asap: true, days: 2, limit: 1 }))[0] ?? fail("Aucune disponibilité immédiate : choisissez un créneau.");
  }
  if (!startsAt || startsAt.getTime() < now.getTime() + 30 * 60_000) fail("Créneau invalide ou trop proche.");
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);

  let promo = null;
  if (inp.promoCode?.trim()) {
    promo = await db.promoCode.findUnique({ where: { code: inp.promoCode.trim().toUpperCase() } });
    if (!promo || !promo.active || (promo.validUntil && promo.validUntil < now) || (promo.maxUses != null && promo.usedCount >= promo.maxUses)) fail("Code promotionnel invalide ou expiré.");
  }
  // Paiement en ligne seulement si l'administrateur l'a activé pour CE barbier ET que le prestataire est configuré ; sinon paiement sur place (aucune commission en ligne).
  const online = offer.partner.onlinePaymentEnabled && paymentsReady();
  const bps = online ? Number(settings.commissionBps) : 0;
  const totals = computeTotals(offer.items.map((i) => i.priceCents * qty(i.serviceId)), offer.zone.travelFeeCents, bps, promo);

  // Transaction : on « verrouille » le barbier (UPDATE) pour sérialiser les réservations concurrentes, puis on revérifie le créneau.
  const booking = await db.$transaction(async (tx) => {
    const p = await tx.partner.update({ where: { id: inp.partnerId }, data: { lockVersion: { increment: 1 } }, include: { availability: true } });
    if (p.status !== "APPROVED") fail("Ce barbier n'est pas disponible.");
    const dayStart = new Date(startsAt!.getTime() - 86_400_000), dayEnd = new Date(endsAt.getTime() + 86_400_000);
    const [booked, off] = await Promise.all([
      busyIntervals(p.id, dayStart, dayEnd, undefined, tx as never),
      tx.timeOff.findMany({ where: { partnerId: p.id, endsAt: { gt: dayStart }, startsAt: { lt: dayEnd } } }),
    ]);
    const inRule = freeSlots({ rules: p.availability, timeOff: [], booked: [], durationMin, travelBufferMin: 0, from: startsAt!, days: 1, now: new Date(0), leadMin: 0, stepMin: 5 })
      .some((s) => s.getTime() === startsAt!.getTime());
    if (!inRule) fail("Ce créneau est en dehors des horaires du barbier.");
    if (!isSlotFree(startsAt!, endsAt, booked, off.map((o) => ({ start: o.startsAt, end: o.endsAt })), p.travelBufferMin)) fail("Ce créneau vient d'être réservé. Choisissez-en un autre.");
    if (promo) {
      const r = await tx.promoCode.updateMany({ where: { id: promo.id, ...(promo.maxUses != null ? { usedCount: { lt: promo.maxUses } } : {}) }, data: { usedCount: { increment: 1 } } });
      if (r.count !== 1) fail("Code promotionnel épuisé.");
    }
    const booking = await tx.booking.create({
      data: {
        number: newNumber(), clientId: inp.clientId, partnerId: p.id, mode: inp.mode, status: online ? "PENDING_PAYMENT" : "REQUESTED", paymentMode: online ? "ONLINE" : "ON_SITE", responseDeadline: online ? null : requestDeadline(inp.mode, p.responseWindowMin, startsAt!, settings), startsAt: startsAt!, endsAt, travelBufferMin: p.travelBufferMin,
        street: inp.address.street.trim(), zip: inp.address.zip.trim(), city: inp.address.city.trim(), access: inp.address.access?.trim() || null, lat: inp.address.lat ?? null, lng: inp.address.lng ?? null,
        ...totals, commissionBps: bps, promoCode: promo?.code ?? null,
        people, items: { create: offer.items.map((i) => ({ serviceId: i.serviceId, name: i.service.name, priceCents: i.priceCents, durationMin: i.durationMin, quantity: qty(i.serviceId) })) },
        ...(online ? { payments: { create: { provider: getProvider().name, idempotencyKey: `bk-${Date.now()}-${Math.random().toString(36).slice(2)}`, status: "REQUIRES_PAYMENT", amountCents: totals.totalCents } } } : {}),
      },
    });
    return booking;
  });
  if (booking.paymentMode === "ON_SITE") await notifyRequest(booking.id); // pas de paiement en ligne : la demande part tout de suite
  return booking;
}

function requestDeadline(mode: string, responseWindowMin: number, startsAt: Date, s: Record<string, string>) {
  return mode === "ASAP" ? new Date(Date.now() + responseWindowMin * 60_000) : new Date(Math.min(Date.now() + Number(s.scheduledResponseHours) * 3_600_000, startsAt.getTime() - 3_600_000));
}
/** Prévient le barbier (nouvelle demande) et le client (demande envoyée). */
async function notifyRequest(bookingId: string) {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { partner: true } });
  const t = b.responseDeadline?.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
  await notify(b.partner.userId, "Nouvelle demande de réservation", `${b.number} — ${fmtDateTime(b.startsAt)} à ${b.city}. Répondez avant ${t}.`, "/partenaire");
  await notify(b.clientId, "Demande envoyée", b.paymentMode === "ON_SITE" ? `Votre demande ${b.number} a été transmise au barbier. Paiement sur place, directement au barbier.` : `Votre demande ${b.number} a été transmise au barbier. Votre carte n'est débitée qu'à son acceptation.`, `/compte/reservations/${b.id}`);
}

/** Étape 1 du paiement. Démo : autorisation immédiate. Stripe : crée le PaymentIntent et renvoie le secret que l'interface Stripe utilise pour confirmer (carte, Apple Pay, Google Pay, TWINT). */
export type PayStart = { kind: "done"; status: string } | { kind: "intent"; clientSecret: string; publishableKey: string };
export async function startPayment(bookingId: string, clientId: string, simulateFailure = false): Promise<PayStart> {
  const b = await db.booking.findFirst({ where: { id: bookingId, clientId }, include: { payments: true, partner: true } }) ?? fail("Réservation introuvable.");
  const pay = b.payments[0];
  if (!pay) fail("Cette réservation se règle sur place : aucun paiement en ligne.");
  if (b.status === "REQUESTED" && ["AUTHORIZED", "CAPTURED"].includes(pay.status)) return { kind: "done", status: b.status }; // déjà payé : pas de double paiement
  if (b.status !== "PENDING_PAYMENT") fail("Cette réservation ne peut plus être payée.");
  if (b.createdAt.getTime() < Date.now() - HOLD_MINUTES * 60_000) {
    const still = await busyIntervals(b.partnerId, b.startsAt, b.endsAt, b.id);
    if (!isSlotFree(b.startsAt, b.endsAt, still, [], b.travelBufferMin)) fail("Le créneau n'est plus disponible. Recommencez la réservation.");
  }
  const prov = getProvider();
  if (prov.interactive && prov.createIntent) {
    const it = await prov.createIntent({ amountCents: pay.amountCents, idempotencyKey: pay.idempotencyKey, bookingId: b.id, description: `GoBarber.ch ${b.number}` });
    await db.payment.update({ where: { id: pay.id }, data: { providerRef: it.id } });
    return { kind: "intent", clientSecret: it.clientSecret, publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "" };
  }
  const res = await prov.authorize({ amountCents: pay.amountCents, idempotencyKey: pay.idempotencyKey, simulateFailure });
  if (!res.ok) {
    await db.payment.update({ where: { id: pay.id }, data: { status: "REQUIRES_PAYMENT", failureReason: res.reason } }); // le client peut réessayer
    throw new BookingError(res.reason);
  }
  const done = await finalizeAuthorization(b.id, res.ref, false);
  return { kind: "done", status: done.status };
}

/** Compatibilité (démo, tests) : paiement immédiat puis réservation renvoyée. */
export async function payBooking(bookingId: string, clientId: string, simulateFailure = false) {
  await startPayment(bookingId, clientId, simulateFailure);
  return db.booking.findUniqueOrThrow({ where: { id: bookingId } });
}

/** Étape 2 : le prestataire confirme que le montant est réservé (ou déjà encaissé en mode automatique). Appelée par la démo ou par le webhook. Idempotente. */
export async function finalizeAuthorization(bookingId: string, ref: string, captured: boolean) {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { payments: true, partner: true } });
  const pay = b.payments[0]; if (!pay) fail("Aucun paiement attendu pour cette réservation.");
  const s = await getSettings();
  const deadline = requestDeadline(b.mode, b.partner.responseWindowMin, b.startsAt, s);
  const moved = await db.$transaction(async (tx) => {
    const r = await tx.booking.updateMany({ where: { id: b.id, status: "PENDING_PAYMENT" }, data: { status: "REQUESTED", responseDeadline: deadline } });
    if (r.count !== 1) return false; // déjà traité (double clic, webhook rejoué…)
    await tx.payment.update({ where: { id: pay!.id }, data: { status: captured ? "CAPTURED" : "AUTHORIZED", providerRef: ref, capturedCents: captured ? pay!.amountCents : 0 } });
    return true;
  });
  if (moved) await notifyRequest(b.id);
  return db.booking.findUniqueOrThrow({ where: { id: b.id } });
}

/** Libère l'autorisation (montant seulement réservé) ou rembourse en entier (déjà encaissé). */
async function undoPayment(pay: { id: string; status: string; providerRef: string | null; amountCents: number }, prov: ReturnType<typeof getProvider>) {
  if (pay.status === "AUTHORIZED" && pay.providerRef) { await prov.release(pay.providerRef); await db.payment.update({ where: { id: pay.id }, data: { status: "RELEASED" } }); }
  else if (pay.status === "CAPTURED" && pay.providerRef) { await prov.refund(pay.providerRef, pay.amountCents); await db.payment.update({ where: { id: pay.id }, data: { status: "REFUNDED", refundedCents: pay.amountCents } }); }
}

async function setStatus(id: string, from: string[], to: string, data: Record<string, unknown> = {}) {
  if (!from.every((f) => canTransition(f, to))) throw new Error(`Transition ${from}→${to} non autorisée`);
  const r = await db.booking.updateMany({ where: { id, status: { in: from } }, data: { status: to, ...data } });
  return r.count === 1;
}

export async function partnerRespond(bookingId: string, partnerId: string, accept: boolean) {
  const b = await db.booking.findFirst({ where: { id: bookingId, partnerId }, include: { payments: true, partner: true } }) ?? fail("Réservation introuvable.");
  if (b.status !== "REQUESTED") fail("Cette demande n'est plus en attente.");
  if (b.responseDeadline && b.responseDeadline < new Date()) { await expireStale(); fail("Le délai de réponse est dépassé."); }
  const pay = b.payments[0], prov = getProvider();
  if (accept) {
    if (!(await setStatus(b.id, ["REQUESTED"], "ACCEPTED", { acceptedAt: new Date() }))) fail("Cette demande n'est plus en attente.");
    if (pay && pay.status === "AUTHORIZED") { await prov.capture(pay.providerRef!, pay.amountCents); await db.payment.update({ where: { id: pay.id }, data: { status: "CAPTURED", capturedCents: pay.amountCents } }); } // mode « automatic » : déjà encaissé
    await notify(b.clientId, "Réservation acceptée", `${b.partner.displayName} a accepté votre rendez-vous du ${fmtDateTime(b.startsAt)}.`, `/compte/reservations/${b.id}`);
  } else {
    if (!(await setStatus(b.id, ["REQUESTED"], "REFUSED", { cancelledBy: "PARTNER", cancelledAt: new Date(), cancelReason: "Refusée par le barbier", refundCents: pay?.amountCents ?? 0 }))) fail("Cette demande n'est plus en attente.");
    if (pay) await undoPayment(pay, prov);
    await notify(b.clientId, "Demande refusée", `Le barbier n'est pas disponible. Aucun montant n'a été débité. Choisissez un autre barbier ou créneau.`, "/reserver");
  }
}

/** Expire les demandes sans réponse (libère l'autorisation) et les paiements abandonnés. À appeler régulièrement (cron) et à l'affichage. */
export async function expireStale() {
  const now = new Date();
  const late = await db.booking.findMany({ where: { status: "REQUESTED", responseDeadline: { lt: now } }, include: { payments: true } });
  for (const b of late) {
    if (!(await setStatus(b.id, ["REQUESTED"], "EXPIRED", { cancelledBy: "SYSTEM", cancelledAt: new Date(), cancelReason: "Sans réponse du barbier", refundCents: b.paymentMode === "ON_SITE" ? 0 : b.totalCents }))) continue;
    const p = b.payments[0];
    if (p) await undoPayment(p, getProvider());
    await notify(b.clientId, "Aucune réponse du barbier", "Votre demande a expiré et n'a pas été débitée. Nous vous invitons à choisir un autre barbier ou créneau.", "/reserver");
  }
  const abandoned = await db.booking.findMany({ where: { status: "PENDING_PAYMENT", createdAt: { lt: new Date(now.getTime() - HOLD_MINUTES * 60_000) } }, select: { id: true } });
  for (const a of abandoned) await setStatus(a.id, ["PENDING_PAYMENT"], "EXPIRED", { cancelledBy: "SYSTEM", cancelReason: "Paiement non finalisé" });
  return late.length + abandoned.length;
}

export async function advance(bookingId: string, partnerId: string, to: "EN_ROUTE" | "IN_PROGRESS" | "COMPLETED" | "NO_SHOW_CLIENT") {
  const b = await db.booking.findFirst({ where: { id: bookingId, partnerId }, include: { partner: true } }) ?? fail("Réservation introuvable.");
  const from = to === "EN_ROUTE" ? ["ACCEPTED"] : to === "IN_PROGRESS" ? ["EN_ROUTE"] : to === "COMPLETED" ? ["IN_PROGRESS"] : ["EN_ROUTE"];
  const stamp = to === "EN_ROUTE" ? { enRouteAt: new Date() } : to === "IN_PROGRESS" ? { startedAt: new Date() } : to === "COMPLETED" ? { completedAt: new Date() } : { cancelledBy: "PARTNER", cancelReason: "Client absent à l'arrivée du barbier", completedAt: new Date() };
  if (to === "EN_ROUTE" && b.startsAt.getTime() - Date.now() > 3 * 3_600_000) fail("Trop tôt : vous pourrez partir dans les 3 h précédant le rendez-vous.");
  if (!(await setStatus(b.id, from, to, stamp))) fail("Statut non modifiable depuis l'état actuel.");
  const msg: Record<string, string> = { EN_ROUTE: "Votre barbier est en route.", IN_PROGRESS: "Votre prestation a commencé.", COMPLETED: "Prestation terminée. Votre reçu est disponible et vous pouvez laisser un avis.", NO_SHOW_CLIENT: "Le barbier signale votre absence : le montant reste dû selon la politique d'annulation." };
  await notify(b.clientId, "Mise à jour de votre rendez-vous", msg[to], `/compte/reservations/${b.id}`);
}

export async function cancelBooking(bookingId: string, by: "CLIENT" | "PARTNER" | "ADMIN", actorId: string, reason = "") {
  const where = by === "CLIENT" ? { id: bookingId, clientId: actorId } : by === "PARTNER" ? { id: bookingId, partnerId: actorId } : { id: bookingId };
  const b = await db.booking.findFirst({ where, include: { payments: true, partner: true } }) ?? fail("Réservation introuvable.");
  if (!canTransition(b.status, "CANCELLED")) fail("Cette réservation ne peut plus être annulée.");
  const policy = toPolicy(await getSettings());
  let out = computeCancellation({ by, status: b.status, totalCents: b.totalCents, travelFeeCents: b.travelFeeCents, startsAt: b.startsAt, acceptedAt: b.acceptedAt, now: new Date(), policy });
  if (b.paymentMode === "ON_SITE") out = { chargeCents: 0, refundCents: 0, reason: "Paiement sur place : aucun montant n'a été prélevé en ligne.", flagPartner: out.flagPartner };
  if (!(await setStatus(b.id, [b.status], "CANCELLED", { cancelledBy: by, cancelledAt: new Date(), cancelReason: reason.slice(0, 300) || out.reason, refundCents: out.refundCents }))) fail("Cette réservation a déjà changé d'état.");
  const pay = b.payments[0], prov = getProvider();
  if (!pay) { /* rendez-vous saisi à la main : aucun paiement en ligne à rembourser */ }
  else if (pay.status === "AUTHORIZED" && pay.providerRef) { await prov.release(pay.providerRef); await db.payment.update({ where: { id: pay.id }, data: { status: "RELEASED" } }); }
  else if (pay.status === "CAPTURED" && out.refundCents > 0 && pay.providerRef) {
    await prov.refund(pay.providerRef, out.refundCents);
    await db.payment.update({ where: { id: pay.id }, data: { refundedCents: out.refundCents, status: out.refundCents >= pay.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
  }
  // Frais retenus : la commission est recalculée sur le montant conservé, le reste revient au barbier (versé via le lot de paiement).
  if (out.chargeCents > 0 && pay) {
    const commission = Math.round((out.chargeCents * b.commissionBps) / 10000);
    await db.booking.update({ where: { id: b.id }, data: { commissionCents: commission, partnerNetCents: out.chargeCents - commission, completedAt: new Date() } });
  }
  const other = by === "CLIENT" ? b.partner.userId : b.clientId;
  await notify(other, "Rendez-vous annulé", `${b.number} a été annulé. ${out.reason}`, by === "CLIENT" ? "/partenaire" : `/compte/reservations/${b.id}`);
  if (by !== "CLIENT") await notify(b.clientId, "Remboursement", `Montant remboursé : CHF ${(out.refundCents / 100).toFixed(2)}.`, `/compte/reservations/${b.id}`, false);
  if (out.flagPartner) await audit(actorId, "partner.late_cancel", "Booking", b.id);
  return out;
}

/** Versements : réservations terminées (ou frais d'annulation retenus) depuis > N h, regroupées par barbier. */
export async function runPayouts(adminId: string) {
  const s = await getSettings();
  const before = new Date(Date.now() - Number(s.payoutDelayHours) * 3_600_000);
  const due = await db.booking.findMany({
    where: { payoutId: null, source: "ONLINE", paymentMode: "ONLINE", completedAt: { lt: before }, status: { in: ["COMPLETED", "NO_SHOW_CLIENT", "CANCELLED"] }, partnerNetCents: { gt: 0 }, dispute: null },
    include: { partner: true },
  });
  const byPartner = new Map<string, typeof due>();
  for (const b of due) { if (b.status === "CANCELLED" && b.cancelledBy !== "CLIENT") continue; byPartner.set(b.partnerId, [...(byPartner.get(b.partnerId) ?? []), b]); }
  let n = 0;
  for (const [partnerId, list] of byPartner) {
    const amount = list.reduce((a, b) => a + b.partnerNetCents, 0);
    const prov = getProvider(), partner = list[0].partner;
    if (!partner.payoutAccountRef) continue; // pas de compte de versement → en attente
    if (prov.name === "stripe" && partner.stripeStatus !== "complete") continue; // inscription Stripe du barbier incomplète
    // Identifiant déterministe : relancer les versements ne paie jamais deux fois le même lot.
    const idem = "payout-" + createHash("sha256").update(list.map((b) => b.id).sort().join(",")).digest("hex").slice(0, 32);
    const payout = await db.payout.create({ data: { partnerId, amountCents: amount, status: "PENDING" } });
    try {
      const ref = prov.transfer ? await prov.transfer({ amountCents: amount, destination: partner.payoutAccountRef, idempotencyKey: idem, description: `GoBarber.ch versement ${payout.id}` }) : `manual_${Date.now()}`;
      await db.payout.update({ where: { id: payout.id }, data: { status: "PAID", paidAt: new Date(), providerRef: ref } });
    } catch (e) { await db.payout.update({ where: { id: payout.id }, data: { status: "FAILED" } }); await audit(adminId, "payout.failed", "Payout", payout.id, { error: String((e as Error).message).slice(0, 200) }); continue; }
    await db.booking.updateMany({ where: { id: { in: list.map((b) => b.id) }, payoutId: null }, data: { payoutId: payout.id } });
    await notify(list[0].partner.userId, "Versement effectué", `CHF ${(amount / 100).toFixed(2)} versés pour ${list.length} prestation(s).`, "/partenaire/revenus");
    n++;
  }
  await audit(adminId, "payouts.run", "Payout", null, { count: n });
  return n;
}

/** Événements Stripe vérifiés (signature) et dédoublonnés par identifiant. */
export async function handleStripeEvent(ev: { id: string; type: string; data: { object: Record<string, unknown> } }) {
  try { await db.paymentEvent.create({ data: { id: ev.id, type: ev.type } }); } catch { return "duplicate" as const; }
  const o = ev.data.object, meta = (o.metadata ?? {}) as Record<string, string>;
  if (ev.type === "payment_intent.amount_capturable_updated" && meta.bookingId) await finalizeAuthorization(meta.bookingId, String(o.id), false); // mode manuel : montant réservé
  else if (ev.type === "payment_intent.succeeded" && meta.bookingId) await finalizeAuthorization(meta.bookingId, String(o.id), true); // mode automatique : déjà encaissé
  else if (ev.type === "payment_intent.payment_failed" && meta.bookingId) await db.payment.updateMany({ where: { bookingId: meta.bookingId, status: "REQUIRES_PAYMENT" }, data: { failureReason: String((o.last_payment_error as { message?: string } | undefined)?.message ?? "Paiement refusé").slice(0, 200) } });
  else if (ev.type === "account.updated") await db.partner.updateMany({ where: { payoutAccountRef: String(o.id) }, data: { stripeStatus: o.details_submitted && o.payouts_enabled ? "complete" : "pending" } });
  return "processed" as const;
}

export async function confirmPaymentEvent(eventId: string, type: string, bookingId?: string) {
  // Dédoublonnage : un événement déjà traité est ignoré (le prestataire renvoie les webhooks).
  try { await db.paymentEvent.create({ data: { id: eventId, type } }); } catch { return "duplicate" as const; }
  if (type === "payment.failed" && bookingId) await db.payment.updateMany({ where: { bookingId, status: "AUTHORIZED" }, data: { status: "FAILED", failureReason: "Échec signalé par le prestataire" } });
  return "processed" as const;
}


// ───────────────────────── Calendrier : ajout / déplacement manuels ─────────────────────────
import { DateTime } from "luxon";
import { TZ } from "@/modules/slots";
import { randomBytes, createHash } from "node:crypto";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
async function assertFree(tx: Tx, partnerId: string, start: Date, end: Date, excludeId?: string) {
  const p = await tx.partner.update({ where: { id: partnerId }, data: { lockVersion: { increment: 1 } } }); // verrou : sérialise les écritures du même barbier
  const booked = await busyIntervals(partnerId, new Date(start.getTime() - 86_400_000), new Date(end.getTime() + 86_400_000), excludeId, tx as never);
  if (!isSlotFree(start, end, booked, [], p.travelBufferMin)) fail("Ce créneau chevauche un autre rendez-vous (temps de trajet compris).");
  return p;
}

export const parseLocal = (date: string, time: string) => { const d = DateTime.fromISO(`${date}T${time}`, { zone: TZ }); return d.isValid ? d.toJSDate() : fail("Date ou heure invalide."); };

export type ManualInput = {
  people?: number;
  actorId: string; partnerId: string; serviceIds: string[]; startsAt: Date; note?: string;
  clientEmail?: string; guestName?: string; guestPhone?: string; address: { street: string; zip: string; city: string };
};
/** Rendez-vous saisi à la main (téléphone, sur place). Statut confirmé, payé hors plateforme : aucune commission, aucun versement. */
export async function createManualBooking(inp: ManualInput) {
  if (!isSwissZip(inp.address.zip) || inp.address.street.trim().length < 3 || inp.address.city.trim().length < 2) fail("Adresse incomplète.");
  if (!inp.serviceIds.length) fail("Choisissez au moins une prestation.");
  if (inp.startsAt.getTime() < Date.now() - 3_600_000) fail("Cette date est déjà passée.");
  const partner = await db.partner.findUnique({ where: { id: inp.partnerId }, include: { zones: true, services: { include: { service: true } } } });
  if (!partner || partner.status !== "APPROVED") fail("Barbier indisponible.");
  const items = inp.serviceIds.map((id) => partner!.services.find((s) => s.serviceId === id && s.active)); if (items.some((i) => !i)) fail("Ce barbier ne propose pas cette prestation.");
  const its = items as NonNullable<(typeof items)[number]>[];
  const durationMin = its.reduce((a, i) => a + i.durationMin, 0), endsAt = new Date(inp.startsAt.getTime() + durationMin * 60_000);
  const fee = partner!.zones.find((z) => z.zip === inp.address.zip)?.travelFeeCents ?? 0;
  const totals = computeTotals(its.map((i) => i.priceCents), fee, 0);
  let clientId: string;
  if (inp.clientEmail?.trim()) { const c = await db.user.findUnique({ where: { email: inp.clientEmail.trim().toLowerCase() } }); if (!c || c.role !== "CLIENT" || c.deletedAt) fail("Aucun client avec cet e-mail."); clientId = c!.id; }
  else {
    if (!inp.guestName?.trim()) fail("Indiquez l'e-mail d'un client existant, ou le nom du client.");
    const g = await db.user.create({ data: { email: `invite-${randomBytes(6).toString("hex")}@gobarber.invalid`, passwordHash: randomBytes(32).toString("hex"), role: "CLIENT", firstName: inp.guestName!.trim().slice(0, 60), lastName: "(invité)", phone: inp.guestPhone?.trim().slice(0, 30) || null } });
    clientId = g.id; // compte « invité » : impossible de s'y connecter (mot de passe aléatoire, e-mail inexistant)
  }
  const booking = await db.$transaction(async (tx) => {
    const p = await assertFree(tx, partner!.id, inp.startsAt, endsAt);
    return tx.booking.create({ data: {
      number: newNumber(), clientId, partnerId: p.id, mode: "SCHEDULED", status: "ACCEPTED", source: "MANUAL", acceptedAt: new Date(), startsAt: inp.startsAt, endsAt, travelBufferMin: p.travelBufferMin,
      street: inp.address.street.trim(), zip: inp.address.zip.trim(), city: inp.address.city.trim(), cancelReason: inp.note?.trim().slice(0, 300) || null,
      ...totals, people: Math.min(MAX_PEOPLE, Math.max(1, Math.floor(inp.people ?? 1))), commissionBps: 0, items: { create: its.map((i) => ({ serviceId: i.serviceId, name: i.service.name, priceCents: i.priceCents, durationMin: i.durationMin })) } } });
  });
  await audit(inp.actorId, "booking.manual_create", "Booking", booking.id, { number: booking.number, partnerId: inp.partnerId });
  if (inp.actorId !== partner!.userId) await notify(partner!.userId, "Nouveau rendez-vous ajouté", `${booking.number} — ${fmtDateTime(inp.startsAt)} à ${inp.address.city}.`, "/partenaire");
  return booking;
}

/** Déplace un rendez-vous (même durée). `partnerScope` limite à un barbier (appel depuis l'espace partenaire). */
export async function rescheduleBooking(bookingId: string, newStart: Date, actorId: string, partnerScope?: string) {
  const b = await db.booking.findFirst({ where: { id: bookingId, ...(partnerScope ? { partnerId: partnerScope } : {}) }, include: { partner: true, client: true } }) ?? fail("Rendez-vous introuvable.");
  if (!["REQUESTED", "ACCEPTED"].includes(b.status)) fail("Seuls les rendez-vous à venir (demandés ou confirmés) peuvent être déplacés.");
  if (newStart.getTime() < Date.now() - 3_600_000) fail("Cette date est déjà passée.");
  const end = new Date(newStart.getTime() + (b.endsAt.getTime() - b.startsAt.getTime()));
  await db.$transaction(async (tx) => { await assertFree(tx, b.partnerId, newStart, end, b.id); await tx.booking.update({ where: { id: b.id }, data: { startsAt: newStart, endsAt: end } }); });
  await audit(actorId, "booking.reschedule", "Booking", b.id, { from: b.startsAt.toISOString(), to: newStart.toISOString() });
  const msg = `${b.number} est déplacé au ${fmtDateTime(newStart)}.`;
  if (b.source === "ONLINE") await notify(b.clientId, "Votre rendez-vous a été déplacé", msg, `/compte/reservations/${b.id}`);
  if (actorId !== b.partner.userId) await notify(b.partner.userId, "Rendez-vous déplacé", msg, `/partenaire/reservations/${b.id}`);
}
