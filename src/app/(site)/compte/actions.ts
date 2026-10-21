"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUser, requireUser, hashPassword, passwordOk, logout, revokeAllSessions } from "@/lib/auth";
import { cancelBooking, BookingError } from "@/lib/booking-service";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { deleteAccountData } from "@/lib/account";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurity } from "@/lib/security";
import { isTerminal } from "@/modules/booking-state";
import { isSwissZip } from "@/modules/zones";

const back = (id: string, q = "") => redirect(`/compte/reservations/${id}${q}`);

export async function cancelAction(fd: FormData) {
  const u = await requireUser(); const id = String(fd.get("id"));
  try { await cancelBooking(id, "CLIENT", u.id, String(fd.get("reason") ?? "")); } catch (e) { if (e instanceof BookingError) back(id, `?e=${encodeURIComponent(e.message)}`); throw e; }
  back(id, "?ok=Réservation annulée.");
}

/** Messagerie : réservée aux deux parties du rendez-vous ; fermée 7 jours après la fin. */
export async function sendMessage(fd: FormData) {
  const u = await requireUser(); const id = String(fd.get("id"));
  const body = z.string().trim().min(1).max(1000).safeParse(fd.get("body"));
  if (!body.success) return;
  if (!rateLimit(`msg:${u.id}`, 30, 600_000).ok) return;
  const b = await db.booking.findUnique({ where: { id }, include: { partner: true } });
  const party = b && (b.clientId === u.id || b.partner.userId === u.id);
  if (!b || !party || ["PENDING_PAYMENT", "REFUSED", "EXPIRED"].includes(b.status)) return;
  await db.message.create({ data: { bookingId: id, senderId: u.id, body: body.data } });
  const to = b.clientId === u.id ? b.partner.userId : b.clientId;
  await notify(to, `Nouveau message — ${b.number}`, "Vous avez reçu un message.", u.role === "PARTNER" ? `/compte/reservations/${id}` : "/partenaire", false);
  revalidatePath(`/compte/reservations/${id}`); revalidatePath("/partenaire");
}

export async function submitReview(fd: FormData) {
  const u = await requireUser(); const id = String(fd.get("id"));
  const p = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(800).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) back(id, "?e=Note invalide.");
  const b = await db.booking.findFirst({ where: { id, clientId: u.id, status: "COMPLETED" }, include: { review: true } });
  if (!b || b.review) back(id, "?e=Avis impossible.");
  await db.$transaction(async (tx) => {
    await tx.review.create({ data: { bookingId: id, rating: p.data!.rating, comment: p.data!.comment ?? "" } });
    const agg = await tx.review.aggregate({ where: { status: "PUBLISHED", booking: { partnerId: b!.partnerId } }, _avg: { rating: true }, _count: true });
    await tx.partner.update({ where: { id: b!.partnerId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count } });
  });
  back(id, "?ok=Merci pour votre avis.");
}

export async function openDispute(fd: FormData) {
  const u = await requireUser(); const id = String(fd.get("id"));
  const reason = z.string().trim().min(10).max(2000).safeParse(fd.get("reason"));
  if (!reason.success) back(id, "?e=Décrivez le problème (10 caractères minimum).");
  const b = await db.booking.findFirst({ where: { id, clientId: u.id, status: { in: ["COMPLETED", "NO_SHOW_CLIENT", "NO_SHOW_PARTNER", "CANCELLED", "IN_PROGRESS", "EN_ROUTE", "ACCEPTED"] } } });
  if (!b) back(id, "?e=Réclamation impossible.");
  if (await db.dispute.findUnique({ where: { bookingId: id } })) back(id, "?e=Une réclamation est déjà ouverte.");
  await db.dispute.create({ data: { bookingId: id, openedBy: u.id, reason: reason.data! } });
  await audit(u.id, "dispute.open", "Booking", id);
  back(id, "?ok=Réclamation transmise à l'assistance. Les versements au barbier sont suspendus pendant l'examen.");
}

export async function saveProfile(fd: FormData) {
  const u = await requireUser();
  const p = z.object({ firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60), phone: z.string().trim().max(30).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/compte/profil?e=Vérifiez les champs.");
  await db.user.update({ where: { id: u.id }, data: { ...p.data, phone: p.data!.phone || null, marketingOptIn: fd.get("marketing") === "on" } });
  redirect("/compte/profil?ok=Profil enregistré.");
}
export async function addAddress(fd: FormData) {
  const u = await requireUser();
  const p = z.object({ label: z.string().trim().min(1).max(30), street: z.string().trim().min(3).max(120), zip: z.string(), city: z.string().trim().min(2).max(60), access: z.string().max(200).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success || !isSwissZip(p.data.zip)) redirect("/compte/profil?e=Adresse invalide.");
  if ((await db.address.count({ where: { userId: u.id } })) >= 10) redirect("/compte/profil?e=10 adresses maximum.");
  await db.address.create({ data: { userId: u.id, ...p.data!, access: p.data!.access || null } });
  redirect("/compte/profil?ok=Adresse ajoutée.");
}
export async function deleteAddress(fd: FormData) {
  const u = await requireUser();
  await db.address.deleteMany({ where: { id: String(fd.get("id")), userId: u.id } }); // filtré par propriétaire
  redirect("/compte/profil");
}
export async function changePassword(fd: FormData) {
  const u = await requireUser(); const pw = String(fd.get("password") ?? "");
  if (!passwordOk(pw)) redirect("/compte/profil?e=Mot de passe trop faible.");
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(pw) } });
  await revokeAllSessions(u.id, u.sid); // les autres appareils sont déconnectés
  redirect("/compte/profil?ok=Mot de passe modifié.");
}

export async function deleteAccount(fd: FormData) {
  const u = await getUser(); if (!u) redirect("/connexion");
  if (String(fd.get("confirm")) !== "SUPPRIMER") redirect("/compte/profil?e=Tapez SUPPRIMER pour confirmer.");
  const r = await deleteAccountData(u.id);
  if (!r.ok) redirect(`/compte/profil?e=${encodeURIComponent(r.error)}`);
  await logout(); redirect("/?deleted=1");
}

/** Signalement d'un message reçu (exigence des stores pour les contenus échangés entre utilisateurs). Modération : Administration → Signalements. */
export async function reportMessage(fd: FormData) {
  const u = await requireUser(); const id = String(fd.get("id")), back = String(fd.get("back") ?? "/compte");
  const m = await db.message.findUnique({ where: { id }, include: { booking: { include: { partner: true } } } });
  const party = m && (m.booking.clientId === u.id || m.booking.partner.userId === u.id) && m.senderId !== u.id; // seulement les messages de l'autre partie
  if (party && rateLimit(`report:${u.id}`, 20, 3600_000).ok) { await db.message.update({ where: { id }, data: { flagged: true } }); await logSecurity("MESSAGE_REPORTED", "INFO", { userId: u.id, detail: m!.booking.number }); }
  redirect((/^\/(?!\/)/.test(back) ? back : "/compte") + "?ok=" + encodeURIComponent("Message signalé à l'équipe. Merci."));
}
