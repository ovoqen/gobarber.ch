import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, getSession } from "@/lib/auth";
import { newSecret, otpauthUrl, verifyTotp } from "@/modules/totp";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { cookies } from "next/headers";
import { audit } from "@/lib/audit";
import { Field, Alert } from "@/components/ui";
export const dynamic = "force-dynamic";
async function enable(fd: FormData) {
  "use server";
  const u = await requireUser("/admin/login");
  if (!["ADMIN", "SUPPORT"].includes(u.role) || u.totpEnabled || !u.totpSecret) redirect("/admin");
  if (!verifyTotp(u.totpSecret, String(fd.get("code") ?? ""))) redirect("/admin/2fa?e=Code incorrect.");
  await db.user.update({ where: { id: u.id }, data: { totpEnabled: true } }); await audit(u.id, "2fa.enable", "User", u.id);
  const cur = await getSession();
  (await cookies()).set(SESSION_COOKIE, await signSession({ uid: u.id, role: u.role, mfa: true, sid: cur?.sid }, "4h"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 4 * 3600 });
  redirect("/admin");
}
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const u = await requireUser("/admin/login"); if (!["ADMIN", "SUPPORT"].includes(u.role)) redirect("/");
  if (u.totpEnabled) redirect("/admin");
  let secret = u.totpSecret; if (!secret) { secret = newSecret(); await db.user.update({ where: { id: u.id }, data: { totpSecret: secret } }); }
  return (
    <div className="mx-auto max-w-md space-y-4"><h1 className="text-2xl font-semibold">Activer l'authentification à deux facteurs</h1><Alert>Obligatoire pour accéder à l'administration. Ajoutez ce compte dans une application d'authentification (Google Authenticator, 1Password, Authy…).</Alert>
      {(await searchParams).e && <Alert kind="error">{(await searchParams).e}</Alert>}
      <div className="card space-y-2 text-sm"><p>Clé secrète à saisir dans l'application :</p><code className="block break-all rounded bg-stone-100 p-2 text-base">{secret}</code><p className="text-muted">Ou lien otpauth : <span className="break-all">{otpauthUrl(u.email, secret)}</span></p></div>
      <form action={enable} className="card space-y-3"><Field label="Code à 6 chiffres affiché par l'application" name="code" required autoComplete="one-time-code" /><button className="btn-dark">Valider et activer</button></form></div>
  );
}
