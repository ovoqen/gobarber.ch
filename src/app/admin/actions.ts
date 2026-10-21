"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff, requireCalendarEditor, hashPassword, passwordOk, revokeAllSessions } from "@/lib/auth";
import { logSecurity } from "@/lib/security";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { cancelBooking, runPayouts, createManualBooking, rescheduleBooking, parseLocal, BookingError } from "@/lib/booking-service";
import { SETTING_DEFAULTS } from "@/lib/settings";
import { getProvider, paymentsReady } from "@/modules/payments/provider";

const go = (path: string, q: string) => redirect(`${path}?${q}`);
const reason = (fd: FormData, p: string) => { const r = String(fd.get("reason") ?? "").trim(); if (r.length < 5) go(p, "e=" + encodeURIComponent("Motif obligatoire (5 caractères minimum).")); return r; };

export async function setPartnerStatus(fd: FormData) {
  const u = await requireStaff("partners.manage"); const id = String(fd.get("id")), to = z.enum(["APPROVED", "REJECTED", "SUSPENDED"]).parse(fd.get("to")), why = reason(fd, "/admin/partenaires");
  const p = await db.partner.findUniqueOrThrow({ where: { id } });
  if (to === "APPROVED") { const docs = await db.partnerDocument.count({ where: { partnerId: id, kind: "ID" } }); if (!p.contractAcceptedAt || !docs) go("/admin/partenaires", "e=" + encodeURIComponent("Activation impossible : contrat non accepté ou pièce d'identité manquante.")); }
  await db.partner.update({ where: { id }, data: { status: to, statusNote: why } });
  if (to === "APPROVED") await db.partnerDocument.updateMany({ where: { partnerId: id, status: "PENDING" }, data: { status: "OK" } });
  await audit(u.id, `partner.${to.toLowerCase()}`, "Partner", id, { reason: why });
  await notify(p.userId, "Statut de votre compte partenaire", to === "APPROVED" ? "Votre profil est validé : vous apparaissez désormais aux clients." : `Statut : ${to}. ${why}`, "/partenaire");
  go("/admin/partenaires", "ok=Statut mis à jour.");
}
export async function adminCancel(fd: FormData) {
  const u = await requireCalendarEditor(); const id = String(fd.get("id")), why = reason(fd, "/admin/reservations");
  try { await cancelBooking(id, "ADMIN", u.id, why); } catch (e) { if (e instanceof BookingError) go("/admin/reservations", "e=" + encodeURIComponent(e.message)); throw e; }
  await audit(u.id, "booking.admin_cancel", "Booking", id, { reason: why }); go("/admin/reservations", "ok=Réservation annulée et remboursée intégralement.");
}
export async function resolveDispute(fd: FormData) {
  const u = await requireStaff("bookings.manage"); const id = String(fd.get("id")), why = reason(fd, "/admin/reservations");
  const refund = Math.round(Number(fd.get("refund") ?? 0) * 100);
  const b = await db.booking.findUniqueOrThrow({ where: { id }, include: { payments: true } }); const pay = b.payments[0];
  if (!Number.isInteger(refund) || refund < 0 || refund > pay.capturedCents - pay.refundedCents) go("/admin/reservations", "e=" + encodeURIComponent("Montant de remboursement invalide."));
  if (refund > 0) {
    await getProvider().refund(pay.providerRef!, refund);
    const total = pay.refundedCents + refund;
    await db.$transaction([db.payment.update({ where: { id: pay.id }, data: { refundedCents: total, status: total >= pay.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED" } }),
      db.booking.update({ where: { id }, data: { refundCents: b.refundCents + refund, partnerNetCents: Math.max(0, b.partnerNetCents - refund) } })]); // le remboursement est supporté par le barbier (déduit de son net) — règle à valider
    await notify(b.clientId, "Remboursement", `CHF ${(refund / 100).toFixed(2)} remboursés suite à votre réclamation.`, `/compte/reservations/${id}`);
  }
  await db.dispute.update({ where: { bookingId: id }, data: { status: refund > 0 ? "RESOLVED" : "REJECTED", resolution: why } });
  await audit(u.id, "dispute.resolve", "Booking", id, { refundCents: refund, reason: why }); go("/admin/reservations", "ok=Réclamation clôturée.");
}
export async function payoutsAction() { const u = await requireStaff("payments.manage"); const n = await runPayouts(u.id); go("/admin/paiements", `ok=${n} versement(s) effectué(s).`); }

export async function saveService(fd: FormData) {
  const u = await requireStaff("catalog.manage");
  const p = z.object({ id: z.string().optional(), code: z.string().regex(/^[a-z0-9-]{2,30}$/), name: z.string().min(2).max(60), description: z.string().max(200), price: z.coerce.number().min(5).max(500), duration: z.coerce.number().int().min(10).max(240), sort: z.coerce.number().int().default(0) }).safeParse(Object.fromEntries(fd));
  if (!p.success) go("/admin/catalogue", "e=Champs invalides.");
  const d = { code: p.data!.code, name: p.data!.name, description: p.data!.description, priceCents: Math.round(p.data!.price * 100), durationMin: p.data!.duration, sort: p.data!.sort, active: fd.get("active") === "on" };
  const s = p.data!.id ? await db.service.update({ where: { id: p.data!.id }, data: d }) : await db.service.create({ data: d });
  await audit(u.id, "service.save", "Service", s.id, d); go("/admin/catalogue", "ok=Enregistré.");
}
export async function savePromo(fd: FormData) {
  const u = await requireStaff("promos.manage");
  const p = z.object({ code: z.string().regex(/^[A-Z0-9]{3,20}$/), percent: z.coerce.number().int().min(0).max(100).default(0), amount: z.coerce.number().min(0).max(500).default(0), max: z.coerce.number().int().min(0).default(0) }).safeParse({ ...Object.fromEntries(fd), code: String(fd.get("code") ?? "").toUpperCase() });
  if (!p.success || (!p.data.percent && !p.data.amount)) go("/admin/promos", "e=Code (A–Z, 0–9) et remise requis.");
  await db.promoCode.upsert({ where: { code: p.data!.code }, update: { percentOff: p.data!.percent || null, amountOffCents: p.data!.amount ? Math.round(p.data!.amount * 100) : null, maxUses: p.data!.max || null }, create: { code: p.data!.code, percentOff: p.data!.percent || null, amountOffCents: p.data!.amount ? Math.round(p.data!.amount * 100) : null, maxUses: p.data!.max || null } });
  await audit(u.id, "promo.save", "PromoCode", p.data!.code); go("/admin/promos", "ok=Enregistré.");
}
export async function togglePromo(fd: FormData) { const u = await requireStaff("promos.manage"); const id = String(fd.get("id")); const p = await db.promoCode.findUniqueOrThrow({ where: { id } }); await db.promoCode.update({ where: { id }, data: { active: !p.active } }); await audit(u.id, "promo.toggle", "PromoCode", id); go("/admin/promos", "ok=OK."); }
export async function moderateReview(id: string, toRaw: string) {
  const u = await requireStaff("reviews.moderate"); const to = z.enum(["PUBLISHED", "HIDDEN"]).parse(toRaw);
  const r = await db.review.update({ where: { id }, data: { status: to }, include: { booking: true } });
  const agg = await db.review.aggregate({ where: { status: "PUBLISHED", booking: { partnerId: r.booking.partnerId } }, _avg: { rating: true }, _count: true });
  await db.partner.update({ where: { id: r.booking.partnerId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count } });
  await audit(u.id, `review.${to.toLowerCase()}`, "Review", id); go("/admin/avis", "ok=OK.");
}
export async function savePage(fd: FormData) {
  const u = await requireStaff("content.manage"); const slug = String(fd.get("slug")), body = String(fd.get("body") ?? "").slice(0, 60000), title = String(fd.get("title") ?? "").slice(0, 120);
  await db.contentPage.update({ where: { slug }, data: { body, title, published: fd.get("published") === "on" } }); await audit(u.id, "content.save", "ContentPage", slug, { length: body.length }); go("/admin/contenus", `ok=${encodeURIComponent("Page enregistrée : " + slug)}&slug=${slug}`);
}
export async function saveSettings(fd: FormData) {
  const u = await requireStaff("settings.manage"); const changes: Record<string, string> = {};
  for (const k of Object.keys(SETTING_DEFAULTS)) { const v = String(fd.get(k) ?? "").trim(); if (v) changes[k] = v; }
  const num = (k: string, min: number, max: number) => { const n = Number(changes[k]); if (k in changes && !(Number.isFinite(n) && n >= min && n <= max)) go("/admin/parametres", `e=${encodeURIComponent(`${k} invalide`)}`); };
  num("commissionBps", 0, 5000); num("freeBeforeHours", 0, 168); num("lateFeePercent", 0, 100); num("lateWindowHours", 0, 48); num("graceMinutesAfterAccept", 0, 60); num("payoutDelayHours", 0, 720);
  for (const [key, value] of Object.entries(changes)) await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  await audit(u.id, "settings.save", "Setting", null, changes); go("/admin/parametres", "ok=Paramètres enregistrés (appliqués aux nouvelles réservations).");
}
export async function setUserActive(fd: FormData) {
  const u = await requireStaff("users.manage"); const id = String(fd.get("id")), why = reason(fd, "/admin/utilisateurs");
  if (id === u.id) go("/admin/utilisateurs", "e=Vous ne pouvez pas vous désactiver vous-même.");
  const t = await db.user.findUniqueOrThrow({ where: { id } }); await db.user.update({ where: { id }, data: { active: !t.active } }); if (t.active) await revokeAllSessions(id); // désactivé = déconnecté partout
  await audit(u.id, t.active ? "user.deactivate" : "user.activate", "User", id, { reason: why }); go("/admin/utilisateurs", "ok=OK.");
}
export async function createStaff(fd: FormData) {
  const u = await requireStaff("users.manage");
  const p = z.object({ email: z.string().trim().toLowerCase().email(), firstName: z.string().min(1).max(60), lastName: z.string().min(1).max(60), role: z.enum(["ADMIN", "SUPPORT"]), password: z.string() }).safeParse(Object.fromEntries(fd));
  if (!p.success || !passwordOk(p.data.password)) go("/admin/utilisateurs", "e=Données invalides ou mot de passe trop faible.");
  if (await db.user.findUnique({ where: { email: p.data!.email } })) go("/admin/utilisateurs", "e=E-mail déjà utilisé.");
  const { password, ...rest } = p.data!; await db.user.create({ data: { ...rest, passwordHash: await hashPassword(password), emailVerifiedAt: new Date() } });
  await audit(u.id, "staff.create", "User", p.data!.email, { role: p.data!.role }); await logSecurity("STAFF_ACCOUNT_CREATED", "HIGH", { userId: u.id, detail: `${p.data!.role} ${p.data!.email}` }); go("/admin/utilisateurs", "ok=Compte créé : la 2FA sera exigée à sa première connexion.");
}

// ── Calendrier : ajout / déplacement / droits ──
const back = (p: string, k: "e" | "ok", m: string) => redirect(`${p}?${k}=${encodeURIComponent(m)}`);
export async function createManualAction(fd: FormData) {
  const u = await requireCalendarEditor();
  const p = z.object({ partnerId: z.string().min(1), date: z.string(), time: z.string(), street: z.string(), zip: z.string(), city: z.string(), clientEmail: z.string().optional(), guestName: z.string().optional(), guestPhone: z.string().optional(), note: z.string().optional(), people: z.coerce.number().int().min(1).max(8).default(1) }).safeParse(Object.fromEntries(fd));
  if (!p.success) back("/admin/calendrier/nouveau", "e", "Remplissez tous les champs obligatoires.");
  try {
    const b = await createManualBooking({ actorId: u.id, partnerId: p.data!.partnerId, serviceIds: fd.getAll("services").map(String), startsAt: parseLocal(p.data!.date, p.data!.time), address: { street: p.data!.street, zip: p.data!.zip, city: p.data!.city }, clientEmail: p.data!.clientEmail, guestName: p.data!.guestName, guestPhone: p.data!.guestPhone, note: p.data!.note, people: p.data!.people });
    back("/admin/calendrier", "ok", `Rendez-vous ${b.number} ajouté.`);
  } catch (e) { if (e instanceof BookingError) back("/admin/calendrier/nouveau", "e", e.message); throw e; }
}
export async function rescheduleAction(fd: FormData) {
  const u = await requireCalendarEditor(); const id = String(fd.get("id"));
  try { await rescheduleBooking(id, parseLocal(String(fd.get("date")), String(fd.get("time"))), u.id); } catch (e) { if (e instanceof BookingError) back(`/admin/calendrier/rdv/${id}`, "e", e.message); throw e; }
  back(`/admin/calendrier/rdv/${id}`, "ok", "Rendez-vous déplacé. Le client et le barbier sont prévenus.");
}
export async function cancelFromCalendar(fd: FormData) {
  const u = await requireCalendarEditor(); const id = String(fd.get("id")), why = String(fd.get("reason") ?? "").trim();
  if (why.length < 5) back(`/admin/calendrier/rdv/${id}`, "e", "Indiquez un motif (5 caractères minimum).");
  try { await cancelBooking(id, "ADMIN", u.id, why); } catch (e) { if (e instanceof BookingError) back(`/admin/calendrier/rdv/${id}`, "e", e.message); throw e; }
  await audit(u.id, "booking.admin_cancel", "Booking", id, { reason: why }); back("/admin/calendrier", "ok", "Rendez-vous annulé.");
}
export async function setStaffCalendar(fd: FormData) {
  const u = await requireStaff("users.manage"); const id = String(fd.get("id")), on = String(fd.get("on")) === "1";
  const t = await db.user.findUniqueOrThrow({ where: { id } }); if (t.role !== "SUPPORT") back("/admin/utilisateurs", "e", "Ce droit ne concerne que les comptes Support (l'administrateur l'a toujours).");
  await db.user.update({ where: { id }, data: { canEditCalendar: on } }); await audit(u.id, on ? "calendar.grant_staff" : "calendar.revoke_staff", "User", id); back("/admin/utilisateurs", "ok", on ? "Droit accordé." : "Droit retiré.");
}
export async function setPartnerCalendar(fd: FormData) {
  const u = await requireStaff("partners.manage"); const id = String(fd.get("id")), on = String(fd.get("on")) === "1";
  await db.partner.update({ where: { id }, data: { canManageCalendar: on } }); await audit(u.id, on ? "calendar.grant_partner" : "calendar.revoke_partner", "Partner", id); back("/admin/partenaires", "ok", on ? "Le barbier peut gérer son calendrier." : "Droit retiré.");
}

/** L'administrateur choisit, barbier par barbier, si le paiement en ligne est actif. Stripe exige que le compte du barbier soit relié et vérifié. */
export async function setPartnerOnlinePayment(fd: FormData) {
  const u = await requireStaff("partners.manage"); const id = String(fd.get("id")), on = String(fd.get("on")) === "1";
  const p = await db.partner.findUniqueOrThrow({ where: { id } });
  if (on) {
    if (!paymentsReady()) back("/admin/partenaires", "e", "Le paiement en ligne n'est pas configuré sur ce serveur (clés Stripe et webhook manquants).");
    if (process.env.PAYMENT_PROVIDER === "stripe" && p.stripeStatus !== "complete") back("/admin/partenaires", "e", "Ce barbier n'a pas terminé son inscription Stripe (compte bancaire) : impossible de l'activer.");
  }
  await db.partner.update({ where: { id }, data: { onlinePaymentEnabled: on } });
  await audit(u.id, on ? "payment.enable_partner" : "payment.disable_partner", "Partner", id); await logSecurity("PAYMENT_MODE_CHANGED", "WARN", { userId: u.id, detail: `${p.displayName} → ${on ? "en ligne" : "sur place"}` });
  back("/admin/partenaires", "ok", on ? "Paiement en ligne activé pour ce barbier." : "Ce barbier est désormais réglé sur place.");
}
