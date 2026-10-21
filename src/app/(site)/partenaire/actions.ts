"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { requirePartner, hashPassword, passwordOk, PASSWORD_HINT, clientIp } from "@/lib/auth";
import { advance, partnerRespond, cancelBooking, createManualBooking, rescheduleBooking, parseLocal, BookingError } from "@/lib/booking-service";
import { saveUpload } from "@/lib/storage";
import { issueToken } from "@/lib/tokens";
import { sendMail, notify } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { isSwissZip } from "@/modules/zones";
import { fromHM } from "@/lib/constants";
import { TZ } from "@/modules/slots";
import { getProvider, StripeProvider } from "@/modules/payments/provider";

const CONTRACT_VERSION = "projet-v1";

export async function registerPartner(fd: FormData) {
  if (!rateLimit(`psignup:${await clientIp()}`, 5, 3600_000).ok) redirect("/partenaire/inscription?e=Trop de tentatives.");
  const p = z.object({ firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60), email: z.string().trim().toLowerCase().email(), phone: z.string().trim().min(6).max(30), password: z.string().max(200), terms: z.literal("on") }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/partenaire/inscription?e=Vérifiez les champs et acceptez les règles.");
  if (!passwordOk(p.data.password)) redirect(`/partenaire/inscription?e=${encodeURIComponent("Mot de passe trop faible : " + PASSWORD_HINT)}`);
  if (!(await db.user.findUnique({ where: { email: p.data.email } }))) {
    const u = await db.user.create({ data: { email: p.data.email, role: "PARTNER", firstName: p.data.firstName, lastName: p.data.lastName, phone: p.data.phone, passwordHash: await hashPassword(p.data.password), partner: { create: { displayName: `${p.data.firstName} ${p.data.lastName.charAt(0)}.` } } } });
    await sendMail(u.email, "Confirmez votre adresse e-mail", `Confirmez : ${process.env.NEXT_PUBLIC_SITE_URL}/verification?token=${await issueToken(u.id, "VERIFY_EMAIL", 1440)}`);
  }
  redirect("/connexion?next=/partenaire/profil&ok=" + encodeURIComponent("Candidature créée. Confirmez votre e-mail, connectez-vous et complétez votre profil."));
}

export async function saveProfilePartner(fd: FormData) {
  const u = await requirePartner();
  const p = z.object({ displayName: z.string().trim().min(2).max(60), bio: z.string().trim().max(600), baseZip: z.string(), baseCity: z.string().trim().min(2).max(60), legalForm: z.string().trim().max(80), ideNumber: z.string().trim().max(20), vatNumber: z.string().trim().max(30).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success || !isSwissZip(p.data.baseZip)) redirect("/partenaire/profil?e=Vérifiez les champs.");
  let photoUrl: string | undefined;
  const photo = fd.get("photo");
  if (photo instanceof File && photo.size > 0) { try { if (photo.type === "application/pdf") throw new Error("La photo doit être JPG ou PNG."); photoUrl = await saveUpload(photo, "photos", 2); } catch (e) { redirect(`/partenaire/profil?e=${encodeURIComponent((e as Error).message)}`); } }
  await db.partner.update({ where: { id: u.partner.id }, data: { ...p.data!, vatNumber: p.data!.vatNumber || null, ...(photoUrl ? { photoUrl } : {}) } });
  redirect("/partenaire/profil?ok=Profil enregistré.");
}
export async function uploadDocument(fd: FormData) {
  const u = await requirePartner(); const kind = z.enum(["ID", "PERMIT", "BUSINESS_PROOF", "INSURANCE", "OTHER"]).safeParse(fd.get("kind")); const f = fd.get("file");
  if (!kind.success || !(f instanceof File) || !f.size) redirect("/partenaire/profil?e=Choisissez un type et un fichier.");
  try { const ref = await saveUpload(f as File, "docs", 5); await db.partnerDocument.create({ data: { partnerId: u.partner.id, kind: kind.data!, fileRef: ref } }); } catch (e) { redirect(`/partenaire/profil?e=${encodeURIComponent((e as Error).message)}`); }
  redirect("/partenaire/profil?ok=Document envoyé.");
}
export async function acceptContract() {
  const u = await requirePartner();
  await db.partner.update({ where: { id: u.partner.id }, data: { contractAcceptedAt: new Date(), contractVersion: CONTRACT_VERSION } });
  await audit(u.id, "contract.accept", "Partner", u.partner.id, { version: CONTRACT_VERSION });
  redirect("/partenaire/profil?ok=Contrat accepté.");
}
export async function submitForReview() {
  const u = await requirePartner(); const p = await db.partner.findUniqueOrThrow({ where: { id: u.partner.id }, include: { zones: true, services: true, availability: true, documents: true } });
  const missing: string[] = [];
  if (!u.emailVerifiedAt) missing.push("e-mail non confirmé"); if (!p.bio) missing.push("présentation"); if (!p.baseZip) missing.push("zone de base"); if (!p.legalForm || !p.ideNumber) missing.push("statut d'activité / n° IDE");
  if (!p.contractAcceptedAt) missing.push("contrat partenaire"); if (!p.services.some((s) => s.active)) missing.push("au moins une prestation"); if (!p.zones.length) missing.push("au moins une zone"); if (!p.availability.length) missing.push("vos disponibilités");
  if (!p.documents.some((d) => d.kind === "ID")) missing.push("pièce d'identité");
  if (missing.length) redirect(`/partenaire/profil?e=${encodeURIComponent("À compléter : " + missing.join(", "))}`);
  if (!["DRAFT", "REJECTED"].includes(p.status)) redirect("/partenaire/profil");
  await db.partner.update({ where: { id: p.id }, data: { status: "PENDING", statusNote: null } });
  redirect("/partenaire/profil?ok=Candidature envoyée. Un administrateur la vérifie avant activation.");
}

export async function savePrestation(fd: FormData) {
  const u = await requirePartner(); const serviceId = String(fd.get("serviceId"));
  const p = z.object({ price: z.coerce.number().min(5).max(500), duration: z.coerce.number().int().min(10).max(240) }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/partenaire/prestations?e=Prix (5–500 CHF) ou durée (10–240 min) invalide.");
  const data = { priceCents: Math.round(p.data!.price * 100), durationMin: p.data!.duration, active: fd.get("active") === "on" };
  await db.partnerService.upsert({ where: { partnerId_serviceId: { partnerId: u.partner.id, serviceId } }, update: data, create: { partnerId: u.partner.id, serviceId, ...data } });
  redirect("/partenaire/prestations?ok=Enregistré.");
}
export async function saveZone(fd: FormData) {
  const u = await requirePartner();
  const p = z.object({ zip: z.string(), city: z.string().trim().min(2).max(60), fee: z.coerce.number().min(0).max(100) }).safeParse(Object.fromEntries(fd));
  if (!p.success || !isSwissZip(p.data.zip)) redirect("/partenaire/prestations?e=Zone invalide (NPA suisse à 4 chiffres, frais 0–100 CHF).");
  await db.partnerZone.upsert({ where: { partnerId_zip: { partnerId: u.partner.id, zip: p.data!.zip } }, update: { city: p.data!.city, travelFeeCents: Math.round(p.data!.fee * 100) }, create: { partnerId: u.partner.id, zip: p.data!.zip, city: p.data!.city, travelFeeCents: Math.round(p.data!.fee * 100) } });
  redirect("/partenaire/prestations?ok=Zone enregistrée.");
}
export async function deleteZone(fd: FormData) { const u = await requirePartner(); await db.partnerZone.deleteMany({ where: { id: String(fd.get("id")), partnerId: u.partner.id } }); redirect("/partenaire/prestations"); }

export async function saveAvailability(fd: FormData) {
  const u = await requirePartner(); const rules: { weekday: number; startMin: number; endMin: number }[] = [];
  for (let d = 1; d <= 7; d++) for (const k of ["a", "b"]) {
    const s = String(fd.get(`${k}s${d}`) ?? ""), e = String(fd.get(`${k}e${d}`) ?? "");
    if (!s || !e) continue; const sm = fromHM(s), em = fromHM(e);
    if (!(em > sm)) redirect("/partenaire/disponibilites?e=Une plage horaire se termine avant son début.");
    rules.push({ weekday: d, startMin: sm, endMin: em });
  }
  for (let d = 1; d <= 7; d++) { const r = rules.filter((x) => x.weekday === d).sort((a, b) => a.startMin - b.startMin); for (let i = 1; i < r.length; i++) if (r[i].startMin < r[i - 1].endMin) redirect("/partenaire/disponibilites?e=Deux plages se chevauchent le même jour."); }
  const buf = z.coerce.number().int().min(5).max(90).catch(20).parse(fd.get("travelBufferMin")), win = z.coerce.number().int().min(5).max(120).catch(15).parse(fd.get("responseWindowMin"));
  await db.$transaction([db.availabilityRule.deleteMany({ where: { partnerId: u.partner.id } }), db.availabilityRule.createMany({ data: rules.map((r) => ({ ...r, partnerId: u.partner.id })) }),
    db.partner.update({ where: { id: u.partner.id }, data: { travelBufferMin: buf, responseWindowMin: win, instantEnabled: fd.get("instant") === "on" } })]);
  redirect("/partenaire/disponibilites?ok=Disponibilités enregistrées.");
}
export async function addTimeOff(fd: FormData) {
  const u = await requirePartner();
  const s = DateTime.fromISO(String(fd.get("from")), { zone: TZ }).startOf("day"), e = DateTime.fromISO(String(fd.get("to")), { zone: TZ }).endOf("day");
  if (!s.isValid || !e.isValid || e < s) redirect("/partenaire/disponibilites?e=Dates invalides.");
  await db.timeOff.create({ data: { partnerId: u.partner.id, startsAt: s.toJSDate(), endsAt: e.toJSDate(), reason: String(fd.get("reason") ?? "").slice(0, 100) || null } });
  redirect("/partenaire/disponibilites?ok=Congé ajouté.");
}
export async function deleteTimeOff(fd: FormData) { const u = await requirePartner(); await db.timeOff.deleteMany({ where: { id: String(fd.get("id")), partnerId: u.partner.id } }); redirect("/partenaire/disponibilites"); }
export async function toggleInstant(fd: FormData) { const u = await requirePartner(); await db.partner.update({ where: { id: u.partner.id }, data: { instantEnabled: fd.get("on") === "1" } }); revalidatePath("/partenaire"); }

export async function respondAction(id: string, accept: boolean) {
  const u = await requirePartner(); let msg = "";
  try { await partnerRespond(id, u.partner.id, accept); } catch (e) { if (e instanceof BookingError) msg = e.message; else throw e; }
  redirect(`/partenaire${msg ? `?e=${encodeURIComponent(msg)}` : ""}`);
}
export async function advanceAction(id: string, to: string) {
  const u = await requirePartner(); let msg = "";
  try { await advance(id, u.partner.id, z.enum(["EN_ROUTE", "IN_PROGRESS", "COMPLETED", "NO_SHOW_CLIENT"]).parse(to)); } catch (e) { if (e instanceof BookingError) msg = e.message; else throw e; }
  redirect(`/partenaire/reservations/${id}${msg ? `?e=${encodeURIComponent(msg)}` : ""}`);
}
export async function partnerCancel(fd: FormData) {
  const u = await requirePartner(); const id = String(fd.get("id")); let msg = "";
  try { await cancelBooking(id, "PARTNER", u.partner.id, String(fd.get("reason") ?? "")); } catch (e) { if (e instanceof BookingError) msg = e.message; else throw e; }
  redirect(`/partenaire/reservations/${id}${msg ? `?e=${encodeURIComponent(msg)}` : ""}`);
}
export async function partnerMessage(fd: FormData) {
  const u = await requirePartner(); const id = String(fd.get("id")); const body = z.string().trim().min(1).max(1000).safeParse(fd.get("body"));
  const b = await db.booking.findFirst({ where: { id, partnerId: u.partner.id, status: { in: ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW_CLIENT"] } } });
  if (!b || !body.success || !rateLimit(`msg:${u.id}`, 30, 600_000).ok) redirect(`/partenaire/reservations/${id}`);
  await db.message.create({ data: { bookingId: id, senderId: u.id, body: body.data! } });
  await notify(b!.clientId, `Nouveau message — ${b!.number}`, "Votre barbier vous a écrit.", `/compte/reservations/${id}`, false);
  redirect(`/partenaire/reservations/${id}`);
}

// ── Calendrier : uniquement si l'administrateur a accordé le droit à ce barbier ──
async function requireCalendarPartner() { const u = await requirePartner(); const fresh = await db.partner.findUniqueOrThrow({ where: { id: u.partner.id } }); if (!fresh.canManageCalendar) redirect("/partenaire?e=" + encodeURIComponent("L'administrateur ne vous a pas encore autorisé à gérer votre calendrier.")); return u; }
export async function partnerCreateManual(fd: FormData) {
  const u = await requireCalendarPartner();
  const p = z.object({ date: z.string(), time: z.string(), street: z.string(), zip: z.string(), city: z.string(), guestName: z.string().min(1), guestPhone: z.string().optional(), note: z.string().optional(), people: z.coerce.number().int().min(1).max(8).default(1) }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/partenaire/nouveau-rdv?e=" + encodeURIComponent("Remplissez tous les champs obligatoires."));
  try { const b = await createManualBooking({ actorId: u.id, partnerId: u.partner.id, serviceIds: fd.getAll("services").map(String), startsAt: parseLocal(p.data!.date, p.data!.time), address: { street: p.data!.street, zip: p.data!.zip, city: p.data!.city }, guestName: p.data!.guestName, guestPhone: p.data!.guestPhone, note: p.data!.note, people: p.data!.people }); redirect("/partenaire?ok=" + encodeURIComponent(b.number)); }
  catch (e) { if (e instanceof BookingError) redirect("/partenaire/nouveau-rdv?e=" + encodeURIComponent(e.message)); throw e; }
}
export async function partnerReschedule(fd: FormData) {
  const u = await requireCalendarPartner(); const id = String(fd.get("id")); let msg = "";
  try { await rescheduleBooking(id, parseLocal(String(fd.get("date")), String(fd.get("time"))), u.id, u.partner.id); } catch (e) { if (e instanceof BookingError) msg = e.message; else throw e; }
  redirect(`/partenaire/reservations/${id}${msg ? "?e=" + encodeURIComponent(msg) : ""}`);
}

/** Relier le compte bancaire du barbier : inscription hébergée par Stripe (identité, IBAN) — rien n'est saisi ni stocké chez nous. */
export async function startConnect() {
  const u = await requirePartner(); const prov = getProvider();
  if (!(prov instanceof StripeProvider)) redirect("/partenaire/revenus?e=" + encodeURIComponent("Mode démonstration : aucun compte Stripe n'est nécessaire."));
  const stripe = prov as StripeProvider; const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200";
  let ref = u.partner.payoutAccountRef;
  try {
    if (!ref) { ref = await stripe.createConnectAccount(u.email); await db.partner.update({ where: { id: u.partner.id }, data: { payoutAccountRef: ref, stripeStatus: "pending" } }); }
    const url = await stripe.accountLink(ref, base + "/partenaire/revenus?ok=1", base + "/partenaire/revenus");
    redirect(url);
  } catch (e) { if ((e as Error).message === "NEXT_REDIRECT" || (e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e; redirect("/partenaire/revenus?e=" + encodeURIComponent("Stripe n'a pas pu ouvrir l'inscription. Réessayez dans un instant.")); }
}
