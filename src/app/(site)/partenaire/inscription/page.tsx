import Link from "next/link";
import { Field, Alert, PageTitle } from "@/components/ui";
import { PASSWORD_HINT } from "@/lib/auth";
import { registerPartner } from "../actions";
export const metadata = { title: "Candidature barbier partenaire" };
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="container-x max-w-md py-12"><PageTitle title="Devenir barbier partenaire" sub="Étape 1 sur 2 : créez votre compte. Vous compléterez ensuite votre profil, vos prestations et vos documents." />
      {sp.e && <div className="mb-4"><Alert kind="error">{sp.e}</Alert></div>}
      <form action={registerPartner} className="card space-y-4">
        <div className="grid grid-cols-2 gap-3"><Field label="Prénom" name="firstName" required autoComplete="given-name" /><Field label="Nom" name="lastName" required autoComplete="family-name" /></div>
        <Field label="E-mail" name="email" type="email" required autoComplete="email" /><Field label="Téléphone" name="phone" type="tel" required autoComplete="tel" />
        <Field label="Mot de passe" name="password" type="password" required autoComplete="new-password" hint={PASSWORD_HINT} />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="terms" required className="mt-1 size-5" /><span>J'ai lu le <Link href="/legal/contrat-partenaire" className="underline">contrat partenaire</Link> (projet) et la <Link href="/legal/confidentialite" className="underline">politique de confidentialité</Link>.</span></label>
        <button className="btn-dark w-full">Créer mon compte partenaire</button></form></div>
  );
}
