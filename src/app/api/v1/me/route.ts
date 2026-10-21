import { apiUser, json, apiError } from "@/lib/api-auth";
import { deleteAccountData } from "@/lib/account";
export async function GET(req: Request) {
  const u = await apiUser(req); if (!u) return apiError("Non connecté", 401);
  return json({ id: u.id, role: u.role, firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone, emailVerified: !!u.emailVerifiedAt, partner: u.partner ? { id: u.partner.id, status: u.partner.status, displayName: u.partner.displayName } : null });
}
/** Suppression du compte depuis l'application (exigée par Apple et Google). */
export async function DELETE(req: Request) {
  const u = await apiUser(req); if (!u) return apiError("Non connecté", 401);
  const r = await deleteAccountData(u.id);
  return r.ok ? json({ ok: true }) : apiError(r.error, 409);
}
