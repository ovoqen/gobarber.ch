import { chf } from "@/modules/pricing";
import { Field } from "@/components/ui";

export type PartnerLite = { id: string; name: string; services: { id: string; name: string; priceCents: number; durationMin: number }[] };
/** Formulaire d'ajout manuel d'un rendez-vous (téléphone, sur place). Composant serveur ; l'action est fournie par la page. */
export function ManualBookingForm({ partner, action, askClientEmail, cancelHref }: { partner: PartnerLite; action: (fd: FormData) => void | Promise<void>; askClientEmail: boolean; cancelHref: string }) {
  return (
    <form action={action} className="card space-y-5">
      <input type="hidden" name="partnerId" value={partner.id} />
      <p className="text-sm text-muted">Barbier : <strong className="text-ink">{partner.name}</strong></p>
      <fieldset><legend className="lbl">Prestation(s) *</legend>
        <div className="space-y-2">{partner.services.map((s) => <label key={s.id} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm"><input type="checkbox" name="services" value={s.id} className="size-5" /><span className="flex-1">{s.name} · {s.durationMin} min</span><span>{chf(s.priceCents)}</span></label>)}{!partner.services.length && <p className="text-sm text-bad">Ce barbier n'a activé aucune prestation.</p>}</div></fieldset>
      <Field label="Nombre de personnes" name="people" type="number" min={1} max={8} defaultValue={1} />
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Date" name="date" type="date" required /><Field label="Heure" name="time" type="time" required step={300} /></div>
      <fieldset className="space-y-3"><legend className="lbl">Client *</legend>
        {askClientEmail && <Field label="E-mail d'un client existant (facultatif)" name="clientEmail" type="email" hint="Sinon, remplissez le nom ci-dessous : un client « invité » sera créé." />}
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Nom du client (si pas de compte)" name="guestName" required={!askClientEmail} /><Field label="Téléphone" name="guestPhone" type="tel" /></div></fieldset>
      <fieldset className="space-y-3"><legend className="lbl">Adresse du rendez-vous *</legend>
        <Field label="Rue et numéro" name="street" required /><div className="grid gap-3 sm:grid-cols-3"><Field label="NPA" name="zip" required /><div className="sm:col-span-2"><Field label="Localité" name="city" required /></div></div></fieldset>
      <div><label htmlFor="note" className="lbl">Note (facultatif)</label><textarea id="note" name="note" rows={2} maxLength={300} className="field" /></div>
      <p className="rounded-lg bg-gold-100 p-3 text-sm">Rendez-vous confirmé tout de suite. <strong>Payé hors plateforme</strong> : aucune commission, aucun versement automatique. Un créneau déjà pris (trajet compris) est refusé.</p>
      <div className="flex gap-3"><button className="btn-gold">Ajouter au calendrier</button><a href={cancelHref} className="btn-ghost">Annuler</a></div>
    </form>
  );
}
