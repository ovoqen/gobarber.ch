import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";
import { hashPassword, passwordOk, PASSWORD_HINT, revokeAllSessions } from "@/lib/auth";
import { logSecurity } from "@/lib/security";
import { Field, Alert, PageTitle } from "@/components/ui";
export const metadata = { title: "Nouveau mot de passe" };
async function act(fd: FormData) {
  "use server";
  const token = String(fd.get("token") ?? ""), pw = String(fd.get("password") ?? "");
  if (!passwordOk(pw)) redirect(`/reinitialiser?token=${encodeURIComponent(token)}&e=1`);
  const uid = await consumeToken(token, "RESET_PASSWORD");
  if (!uid) redirect("/reinitialiser?e=2");
  await db.user.update({ where: { id: uid! }, data: { passwordHash: await hashPassword(pw), failedLogins: 0, lockedUntil: null, emailVerifiedAt: new Date() } });
  await revokeAllSessions(uid!); await logSecurity("PASSWORD_RESET", "WARN", { userId: uid });
  redirect("/connexion?ok=" + encodeURIComponent("Mot de passe modifié. Connectez-vous."));
}
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; e?: string }> }) {
  const sp = await searchParams;
  return <div className="container-x max-w-md py-12"><PageTitle title="Nouveau mot de passe" />
    {sp.e === "2" || !sp.token ? <Alert kind="error">Lien invalide ou expiré.</Alert> : <form action={act} className="card space-y-4">
      {sp.e === "1" && <Alert kind="error">Mot de passe trop faible. {PASSWORD_HINT}</Alert>}
      <input type="hidden" name="token" value={sp.token} /><Field label="Nouveau mot de passe" name="password" type="password" required autoComplete="new-password" hint={PASSWORD_HINT} /><button className="btn-dark w-full">Enregistrer</button></form>}</div>;
}
