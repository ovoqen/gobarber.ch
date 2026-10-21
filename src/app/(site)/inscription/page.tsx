import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, passwordOk, PASSWORD_HINT, clientIp } from "@/lib/auth";
import { issueToken } from "@/lib/tokens";
import { sendMail } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { Field, Alert, PageTitle } from "@/components/ui";
export const metadata = { title: "Créer mon profil" };

async function act(fd: FormData) {
  "use server";
  if (!rateLimit(`signup:${await clientIp()}`, 5, 3600_000).ok) redirect("/inscription?e=Trop de tentatives, réessayez plus tard.");
  const p = z.object({ firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60), email: z.string().trim().toLowerCase().email().max(200), phone: z.string().trim().max(30).optional(), password: z.string().max(200), terms: z.literal("on") }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/inscription?e=Vérifiez les champs et acceptez les conditions.");
  if (!passwordOk(p.data.password)) redirect(`/inscription?e=${encodeURIComponent("Mot de passe trop faible : " + PASSWORD_HINT)}`);
  const exists = await db.user.findUnique({ where: { email: p.data.email } });
  if (!exists) {
    const u = await db.user.create({ data: { email: p.data.email, firstName: p.data.firstName, lastName: p.data.lastName, phone: p.data.phone || null, passwordHash: await hashPassword(p.data.password), marketingOptIn: fd.get("marketing") === "on" } });
    const t = await issueToken(u.id, "VERIFY_EMAIL", 60 * 24);
    await sendMail(u.email, "Confirmez votre adresse e-mail", `Bienvenue sur GoBarber.ch.\n\nConfirmez votre adresse : ${process.env.NEXT_PUBLIC_SITE_URL}/verification?token=${t}\n\nLien valable 24 h.`);
  }
  // Même réponse que le compte existe ou non : pas d'énumération d'adresses.
  redirect("/connexion?ok=" + encodeURIComponent("Compte créé. Consultez votre e-mail pour confirmer votre adresse, puis connectez-vous."));
}
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="container-x max-w-md py-12">
      <PageTitle title="Créer mon profil" sub="Gratuit. Il sert à réserver, suivre vos rendez-vous, payer en ligne et retrouver vos reçus." />{sp.e && <div className="mb-4"><Alert kind="error">{sp.e}</Alert></div>}
      <form action={act} className="card space-y-4">
        <div className="grid grid-cols-2 gap-3"><Field label="Prénom" name="firstName" required autoComplete="given-name" /><Field label="Nom" name="lastName" required autoComplete="family-name" /></div>
        <Field label="E-mail" name="email" type="email" required autoComplete="email" />
        <Field label="Téléphone (facultatif)" name="phone" type="tel" autoComplete="tel" hint="Utile pour que le barbier vous joigne le jour J." />
        <Field label="Mot de passe" name="password" type="password" required autoComplete="new-password" hint={PASSWORD_HINT} />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="terms" required className="mt-1 size-5" /><span>J'accepte les <Link href="/legal/conditions-generales" className="underline">conditions générales</Link> et la <Link href="/legal/confidentialite" className="underline">politique de confidentialité</Link>.</span></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="marketing" className="mt-1 size-5" /><span>Je souhaite recevoir des offres par e-mail (facultatif).</span></label>
        <button className="btn-dark w-full">Créer mon profil</button>
        <p className="text-center text-sm">Déjà inscrit ? <Link href="/connexion" className="underline">Connexion</Link></p>
      </form>
    </div>
  );
}
