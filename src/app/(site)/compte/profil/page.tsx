import Link from "next/link";
import { db } from "@/lib/db";
import { requireClient, PASSWORD_HINT } from "@/lib/auth";
import { Alert, Field, NavTabs, PageTitle } from "@/components/ui";
import { DevicesPanel } from "../appareils";
import { saveProfile, addAddress, deleteAddress, changePassword, deleteAccount } from "../actions";
export const metadata = { title: "Profil et confidentialité" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const u = await requireClient(); const sp = await searchParams;
  const addresses = await db.address.findMany({ where: { userId: u.id } });
  return (
    <div className="container-x max-w-3xl py-10">
      <PageTitle title="Profil et confidentialité" /><NavTabs current="/compte/profil" items={[["/compte", "Mes réservations"], ["/compte/profil", "Profil et confidentialité"]]} />
      <div className="space-y-6">
        {sp.ok && <Alert kind="ok">{sp.ok}</Alert>}{sp.e && <Alert kind="error">{sp.e}</Alert>}
        <form action={saveProfile} className="card space-y-4"><h2 className="text-xl font-semibold">Coordonnées</h2>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Prénom" name="firstName" defaultValue={u.firstName} required /><Field label="Nom" name="lastName" defaultValue={u.lastName} required /></div>
          <Field label="Téléphone" name="phone" type="tel" defaultValue={u.phone} /><p className="text-sm text-muted">E-mail : {u.email}</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="marketing" defaultChecked={u.marketingOptIn} className="size-5" />Recevoir des offres par e-mail</label><button className="btn-dark">Enregistrer</button></form>
        <section className="card space-y-3"><h2 className="text-xl font-semibold">Adresses enregistrées</h2>
          <ul className="space-y-2 text-sm">{addresses.map((a) => <li key={a.id} className="flex items-center justify-between gap-2"><span><strong>{a.label}</strong> — {a.street}, {a.zip} {a.city}</span><form action={deleteAddress}><input type="hidden" name="id" value={a.id} /><button className="text-bad underline">Supprimer</button></form></li>)}{!addresses.length && <li className="text-muted">Aucune adresse.</li>}</ul>
          <form action={addAddress} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2"><Field label="Nom (Domicile, Bureau…)" name="label" defaultValue="Domicile" required /><Field label="Rue et numéro" name="street" required /><Field label="NPA" name="zip" required /><Field label="Localité" name="city" required /><div className="sm:col-span-2"><Field label="Accès / étage (facultatif)" name="access" /></div><button className="btn-ghost sm:col-span-2">Ajouter l'adresse</button></form></section>
        <form action={changePassword} className="card space-y-3"><h2 className="text-xl font-semibold">Mot de passe</h2><Field label="Nouveau mot de passe" name="password" type="password" required autoComplete="new-password" hint={PASSWORD_HINT} /><button className="btn-ghost">Modifier</button></form>
        <DevicesPanel userId={u.id} currentSid={u.sid} back="/compte/profil" />
        <section className="card space-y-3"><h2 className="text-xl font-semibold">Vos données</h2><p className="text-sm text-muted">Accès, portabilité, suppression : voir la <Link href="/legal/confidentialite" className="underline">politique de confidentialité</Link>. La géolocalisation est facultative : vous pouvez toujours saisir votre adresse à la main.</p>
          <a href="/api/me/export" className="btn-ghost">Télécharger mes données (JSON)</a>
          <form action={deleteAccount} className="space-y-2 border-t border-line pt-3"><label htmlFor="confirm" className="lbl">Supprimer mon compte (irréversible)</label><input id="confirm" name="confirm" className="field max-w-xs" placeholder="Tapez SUPPRIMER" /><p className="text-xs text-muted">Vos données personnelles sont effacées ; les pièces comptables sont conservées sans identité (obligation légale).</p><button className="btn-danger">Supprimer définitivement</button></form></section>
      </div>
    </div>
  );
}
