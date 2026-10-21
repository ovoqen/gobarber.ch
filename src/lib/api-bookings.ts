import { db } from "./db";
const LIVE = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];
const include = { items: true, partner: { select: { id: true, displayName: true, userId: true } }, client: { select: { firstName: true } } } as const;
type B = Awaited<ReturnType<typeof load>>[number];
export const load = (where: object, take = 50) => db.booking.findMany({ where, include, orderBy: { startsAt: "desc" }, take });

/** Vue d'une réservation pour l'application. Le barbier ne reçoit l'adresse complète que pendant le rendez-vous actif. */
export function viewBooking(b: B, viewer: "CLIENT" | "PARTNER") {
  const showAddress = viewer === "CLIENT" || LIVE.includes(b.status);
  return {
    id: b.id, number: b.number, status: b.status, paymentMode: b.paymentMode, startsAt: b.startsAt, endsAt: b.endsAt, people: b.people,
    address: showAddress ? { street: b.street, zip: b.zip, city: b.city, access: b.access } : { zip: b.zip, city: b.city },
    items: b.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPriceCents: i.priceCents, durationMin: i.durationMin })),
    subtotalCents: b.subtotalCents, discountCents: b.discountCents, travelFeeCents: b.travelFeeCents, totalCents: b.totalCents, refundCents: b.refundCents,
    ...(viewer === "PARTNER" ? { client: { firstName: b.client.firstName }, partnerNetCents: b.partnerNetCents, commissionCents: b.commissionCents } : { partner: { id: b.partner.id, displayName: b.partner.displayName } }),
    responseDeadline: b.responseDeadline, cancelledBy: b.cancelledBy, cancelReason: b.cancelReason,
  };
}
