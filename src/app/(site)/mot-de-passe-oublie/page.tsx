import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { issueToken } from "@/lib/tokens";
import { sendMail } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth";
import { Field, Alert, PageTitle } from "@/components/ui";
export const metadata = { title: "Mot de passe oublié" };
async function act(fd: FormData) {
  "use server";
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (rateLimit(`reset:${await clientIp()}`, 5, 3600_000).ok) {
    const u = await db.user.findUnique({ where: { email } });
    if (u && u.active && !u.deletedAt) { const t = await issueToken(u.id, "RESET_PASSWORD", 60); await sendMail(u.email, "Réinitialisation du mot de passe", `Réinitialisez votre mot de passe : ${process.env.NEXT_PUBLIC_SITE_URL}/reinitialiser?token=${t}\n\nLien valable 1 h. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`); }
  }
  redirect("/mot-de-passe-oublie?sent=1");
}
export default async function Page({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const sp = await searchParams;
  return <div className="container-x max-w-md py-12"><PageTitle title="Mot de passe oublié" />
    {sp.sent ? <Alert kind="ok">Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.</Alert> :
    <form action={act} className="card space-y-4"><Field label="E-mail" name="email" type="email" required autoComplete="email" /><button className="btn-dark w-full">Envoyer le lien</button></form>}</div>;
}
