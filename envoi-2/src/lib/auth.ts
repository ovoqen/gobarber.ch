import "server-only";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, signSession, verifySession } from "./session";
import { can, STAFF, type Permission } from "./rbac";
import { rateLimitShared } from "./rate-limit";
import { verifyTotp } from "@/modules/totp";
import { createSession, validSession, revokeSession, revokeAllSessions } from "./sessions";
import { logSecurity, checkBruteForce } from "./security";
export { revokeAllSessions };

const MAX_FAILED = 5, LOCK_MIN = 15;
export const hashPassword = (p: string) => bcrypt.hash(p, 11);
export const passwordOk = (p: string) => p.length >= 10 && /[a-zA-Z]/.test(p) && /\d/.test(p);
export const PASSWORD_HINT = "10 caractères minimum, avec lettres et chiffres.";

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

export async function login(email: string, password: string, totp?: string, remember = true) {
  const ip = await clientIp();
  const rl = await rateLimitShared(`login:${ip}`, 10, 10 * 60_000);
  if (!rl.ok) { await logSecurity("RATE_LIMIT_LOGIN", "WARN", { ip }); return { ok: false as const, error: `Trop de tentatives. Réessayez dans ${Math.ceil(rl.retryAfterSec / 60)} min.` }; }
  const generic = { ok: false as const, error: "Identifiants incorrects." };
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.active || user.deletedAt) { await bcrypt.compare(password, "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali"); return generic; }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false as const, error: "Compte temporairement verrouillé. Réessayez plus tard." };
  const fail = async () => {
    const failed = user.failedLogins + 1;
    await logSecurity("LOGIN_FAILED", "INFO", { userId: user.id, ip }); await checkBruteForce(ip);
    if (failed >= MAX_FAILED) await logSecurity("ACCOUNT_LOCKED", STAFF.includes(user.role as never) ? "HIGH" : "WARN", { userId: user.id, ip, detail: user.role });
    await db.user.update({ where: { id: user.id }, data: { failedLogins: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MIN * 60_000) : null } });
    return generic;
  };
  if (!(await bcrypt.compare(password, user.passwordHash))) return fail();
  const staff = STAFF.includes(user.role as never);
  let mfa = !staff;
  if (staff && user.totpEnabled) { if (!totp || !user.totpSecret || !verifyTotp(user.totpSecret, totp)) return totp ? fail() : { ok: false as const, error: "Code d'authentification à 6 chiffres requis.", needTotp: true }; mfa = true; }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  // Personnel : 4 h, jamais « connexion automatique ». Clients et barbiers : 30 jours si « Rester connecté », sinon cookie de session (fermeture du navigateur).
  const ttlMs = staff ? 4 * 3600_000 : remember ? 30 * 86_400_000 : 12 * 3600_000;
  const sess = await createSession({ userId: user.id, kind: "WEB", ttlMs, ip, device: (await headers()).get("user-agent") });
  if (staff) await logSecurity("ADMIN_LOGIN", "WARN", { userId: user.id, ip, detail: user.role });
  const token = await signSession({ uid: user.id, role: user.role, mfa, sid: sess.id }, Math.floor((Date.now() + ttlMs) / 1000));
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", ...(staff || remember ? { maxAge: Math.floor(ttlMs / 1000) } : {}) });
  return { ok: true as const, role: user.role, mfa };
}

export async function logout() { const s = await getSession(); if (s?.sid) await revokeSession(s.sid); (await cookies()).delete(SESSION_COOKIE); }

export async function getSession() { return verifySession((await cookies()).get(SESSION_COOKIE)?.value); }
export async function getUser() {
  const s = await getSession();
  if (!s) return null;
  const user = await db.user.findUnique({ where: { id: s.uid }, include: { partner: true } });
  // Le rôle fait foi en base (une rétrogradation prend effet immédiatement), pas dans le jeton.
  if (!user || !user.active || user.deletedAt || user.role !== s.role) return null;
  if (!(await validSession(s.sid, user.id))) return null; // session révoquée, expirée ou inconnue
  return { ...user, mfa: s.mfa, sid: s.sid as string };
}
export async function requireUser(loginPath = "/connexion") {
  const u = await getUser(); if (!u) redirect(loginPath); return u;
}
export async function requireClient() { const u = await requireUser(); if (u.role !== "CLIENT") redirect("/"); return u; }
export async function requirePartner() {
  const u = await requireUser("/connexion?next=/partenaire"); if (u.role !== "PARTNER" || !u.partner) redirect("/"); return { ...u, partner: u.partner };
}
/** Droit d'ajouter / déplacer / annuler des rendez-vous : toujours pour ADMIN, pour SUPPORT seulement si l'admin le lui a accordé. */
export const canEditCalendar = (u: { role: string; canEditCalendar?: boolean }) => u.role === "ADMIN" || (u.role === "SUPPORT" && !!u.canEditCalendar);
export async function requireCalendarEditor() {
  const u = await requireStaff("bookings.manage");
  if (!canEditCalendar(u)) redirect("/admin/calendrier?e=" + encodeURIComponent("Vous n'avez pas le droit de modifier le calendrier. Demandez-le à un administrateur."));
  return u;
}

/** Personnel : mot de passe + 2FA validée + permission. */
export async function requireStaff(permission: Permission = "admin.view") {
  const u = await requireUser("/admin/login");
  if (!STAFF.includes(u.role as never)) redirect("/");
  if (!u.mfa) redirect("/admin/2fa");
  if (!can(u.role, permission)) redirect("/admin?denied=1");
  return u;
}
