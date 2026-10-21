import Link from "next/link";
import { db } from "@/lib/db";
import { requirePartner } from "@/lib/auth";
import { Alert, Field, PageTitle } from "@/components/ui";
import { PNav } from "../PartnerNav";
import { saveProfilePartner, uploadDocument, acceptContract, submitForReview } from "../actions";
import { deleteAccount } from "../../compte/actions";
import { DevicesPanel } from "../../compte/appareils";
export const metadata = { title: "Profil partenaire" };
export const dynamic = "force-dynamic";
const KINDS: Record<string, string> = { ID: "Pièce d'identité", PERMIT: "Autorisation de travail / séjour", BUSINESS_PROOF: "Justificatif d'activité indépendante", INSURANCE: "Assurance RC professionnelle", OTHER: "Autre" };
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const u = await requirePartner(); const sp = await searchParams;
  const p = await db.partner.findUniqueOrThrow({ where: { id: u.partner.id }, include: { documents: true } });
  const editable = ["DRAFT", "REJECTED", "APPROVED", "PENDING"].includes(p.status);
  return (
    <div className="container-x max-w-3xl py-10"><PageTitle title="Profil et documents" sub={`Statut : ${({ DRAFT: "brouillon", PENDING: "en vérification", APPROVED: "actif", SUSPENDED: "suspendu", REJECTED: "refusé" } as Record<string, string>)[p.status]}`} /><PNav current="/partenaire/profil" />
      <div className="space-y-6">{sp.ok && <Alert kind="ok">{sp.ok}</Alert>}{sp.e && <Alert kind="error">{sp.e}</Alert>}{p.statusNote && <Alert>{p.statusNote}</Alert>}
        <form action={saveProfilePartner} className="card space-y-4" encType="multipart/form-data"><h2 className="text-xl font-semibold">Présentation publique</h2>
          <Field label="Nom affiché aux clients" name="displayName" defaultValue={p.displayName} required /><div><label className="lbl" htmlFor="bio">Présentation</label><textarea id="bio" name="bio" rows={4} maxLength={600} defaultValue={p.bio} className="field" /></div>
          <div><label className="lbl" htmlFor="photo">Photo de profil (JPG/PNG, 2 Mo max)</label><input id="photo" name="photo" type="file" accept="image/jpeg,image/png" className="field" /></div>
          <h2 className="pt-2 text-xl font-semibold">Activité</h2><div className="grid gap-3 sm:grid-cols-2"><Field label="NPA de départ" name="baseZip" defaultValue={p.baseZip} required /><Field label="Localité" name="baseCity" defaultValue={p.baseCity} required /></div>
          <Field label="Statut d'activité (raison individuelle, Sàrl…)" name="legalForm" defaultValue={p.legalForm} hint="À confirmer avec votre caisse AVS / fiduciaire." /><div className="grid gap-3 sm:grid-cols-2"><Field label="N° IDE (CHE-xxx.xxx.xxx)" name="ideNumber" defaultValue={p.ideNumber} /><Field label="N° TVA (si assujetti)" name="vatNumber" defaultValue={p.vatNumber} /></div><button className="btn-dark">Enregistrer</button></form>
        <section className="card space-y-3"><h2 className="text-xl font-semibold">Documents</h2><p className="text-sm text-muted">Conservés dans un stockage privé, consultés uniquement par l'équipe de vérification (chaque consultation est journalisée).</p>
          <ul className="text-sm">{p.documents.map((d) => <li key={d.id}>{KINDS[d.kind]} — {d.status === "OK" ? "validé" : d.status === "REJECTED" ? "refusé" : "en attente"}</li>)}{!p.documents.length && <li className="text-muted">Aucun document.</li>}</ul>
          <form action={uploadDocument} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_1fr_auto]" encType="multipart/form-data"><div><label className="lbl" htmlFor="kind">Type</label><select id="kind" name="kind" className="field">{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div><div><label className="lbl" htmlFor="file">Fichier (PDF/JPG/PNG, 5 Mo)</label><input id="file" name="file" type="file" required accept="application/pdf,image/jpeg,image/png" className="field" /></div><button className="btn-ghost self-end">Envoyer</button></form></section>
        <section className="card space-y-3"><h2 className="text-xl font-semibold">Contrat partenaire</h2>{p.contractAcceptedAt ? <p className="text-sm text-ok">Accepté le {p.contractAcceptedAt.toLocaleDateString("fr-CH")} (version {p.contractVersion}).</p> : <form action={acceptContract} className="space-y-3"><p className="text-sm">Lisez le <Link href="/legal/contrat-partenaire" className="underline" target="_blank">contrat et les règles de la plateforme</Link> (projet soumis à validation juridique).</p><button className="btn-dark">J'ai lu et j'accepte</button></form>}</section>
        <section className="card space-y-3"><h2 className="text-xl font-semibold">Versements</h2><p className="text-sm text-muted">Le rattachement de votre compte bancaire se fait chez le prestataire de paiement (onboarding hébergé) — GoBarber.ch ne collecte pas votre IBAN. {p.payoutAccountRef ? "Compte relié." : "À brancher avec Stripe Connect."}</p></section>
        {["DRAFT", "REJECTED"].includes(p.status) && editable && <form action={submitForReview}><button className="btn-gold">Envoyer ma candidature pour validation</button></form>}
        <DevicesPanel userId={u.id} currentSid={u.sid} back="/partenaire/profil" />
        <form action={deleteAccount} className="card space-y-2"><label htmlFor="confirm" className="lbl">Supprimer mon compte partenaire</label><input id="confirm" name="confirm" className="field max-w-xs" placeholder="Tapez SUPPRIMER" /><button className="btn-danger">Supprimer</button></form></div></div>
  );
}
