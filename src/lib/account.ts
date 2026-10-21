import { randomBytes } from "node:crypto";
import { db } from "./db";
import { audit } from "./audit";
import { revokeAllSessions } from "./sessions";

const DONE = ["COMPLETED", "CANCELLED", "REFUSED", "EXPIRED", "NO_SHOW_CLIENT", "NO_SHOW_PARTNER"];

/** Suppression de compte : refusée tant qu'une réservation est en cours ; sinon anonymisation
 *  (les pièces comptables restent, sans données personnelles — obligation de conservation légale). */
export async function deleteAccountData(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = await db.user.findUnique({ where: { id: userId }, include: { partner: true } });
  if (!u || u.deletedAt) return { ok: false, error: "Compte introuvable." };
  const active = await db.booking.count({ where: { status: { notIn: DONE }, ...(u.partner ? { partnerId: u.partner.id } : { clientId: u.id }) } });
  if (active) return { ok: false, error: "Vous avez des réservations en cours : terminez-les ou annulez-les avant de supprimer votre compte." };
  await db.$transaction([
    db.address.deleteMany({ where: { userId } }), db.notification.deleteMany({ where: { userId } }), db.message.deleteMany({ where: { senderId: userId } }), db.authToken.deleteMany({ where: { userId } }),
    db.booking.updateMany({ where: { clientId: userId }, data: { street: "—", access: null, lat: null, lng: null } }),
    ...(u.partner ? [db.partner.update({ where: { id: u.partner.id }, data: { status: "SUSPENDED", displayName: "Barbier supprimé", bio: "", photoUrl: null, payoutAccountRef: null, ideNumber: null, vatNumber: null } }), db.partnerDocument.deleteMany({ where: { partnerId: u.partner.id } })] : []),
    db.user.update({ where: { id: userId }, data: { email: `deleted-${randomBytes(6).toString("hex")}@deleted.invalid`, firstName: "Compte", lastName: "supprimé", phone: null, passwordHash: randomBytes(32).toString("hex"), active: false, deletedAt: new Date(), totpSecret: null, marketingOptIn: false } }),
  ]);
  await revokeAllSessions(userId);
  await audit(userId, "account.delete", "User", userId);
  return { ok: true };
}
