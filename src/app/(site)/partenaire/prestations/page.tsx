import { db } from "@/lib/db";
import { requirePartner } from "@/lib/auth";
import { Alert, PageTitle } from "@/components/ui";
import { PNav } from "../PartnerNav";
import { savePrestation, saveZone, deleteZone } from "../actions";
export const metadata = { title: "Prestations et zones" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const u = await requirePartner(); const sp = await searchParams;
  const [services, mine, zones] = await Promise.all([db.service.findMany({ where: { active: true }, orderBy: { sort: "asc" } }), db.partnerService.findMany({ where: { partnerId: u.partner.id } }), db.partnerZone.findMany({ where: { partnerId: u.partner.id }, orderBy: { zip: "asc" } })]);
  return (
    <div className="container-x max-w-3xl py-10"><PageTitle title="Prestations, tarifs et zones" /><PNav current="/partenaire/prestations" />
      <div className="space-y-6">{sp.ok && <Alert kind="ok">{sp.ok}</Alert>}{sp.e && <Alert kind="error">{sp.e}</Alert>}
        <section className="space-y-3"><h2 className="text-xl font-semibold">Prestations</h2>{services.map((s) => { const m = mine.find((x) => x.serviceId === s.id);
          return <form key={s.id} action={savePrestation} className="card grid items-end gap-3 sm:grid-cols-[1fr_7rem_7rem_auto_auto]"><input type="hidden" name="serviceId" value={s.id} /><div><p className="font-semibold">{s.name}</p><p className="text-xs text-muted">{s.description}</p></div>
            <div><label className="lbl" htmlFor={`p${s.id}`}>Prix CHF</label><input id={`p${s.id}`} name="price" type="number" step="0.5" min={5} max={500} defaultValue={((m?.priceCents ?? s.priceCents) / 100).toFixed(2)} className="field" /></div>
            <div><label className="lbl" htmlFor={`d${s.id}`}>Durée (min)</label><input id={`d${s.id}`} name="duration" type="number" min={10} max={240} defaultValue={m?.durationMin ?? s.durationMin} className="field" /></div>
            <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" name="active" defaultChecked={m?.active ?? false} className="size-5" />Proposer</label><button className="btn-dark">OK</button></form>; })}</section>
        <section className="card space-y-3"><h2 className="text-xl font-semibold">Zones de déplacement</h2>
          <ul className="space-y-1 text-sm">{zones.map((z) => <li key={z.id} className="flex items-center justify-between"><span>{z.zip} {z.city} · frais CHF {(z.travelFeeCents / 100).toFixed(2)}</span><form action={deleteZone}><input type="hidden" name="id" value={z.id} /><button className="text-bad underline">Retirer</button></form></li>)}{!zones.length && <li className="text-muted">Aucune zone.</li>}</ul>
          <form action={saveZone} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-4"><div><label className="lbl" htmlFor="zip">NPA</label><input id="zip" name="zip" required inputMode="numeric" maxLength={4} className="field" /></div><div><label className="lbl" htmlFor="city">Localité</label><input id="city" name="city" required className="field" /></div><div><label className="lbl" htmlFor="fee">Frais (CHF)</label><input id="fee" name="fee" type="number" step="0.5" min={0} max={100} defaultValue={10} className="field" /></div><button className="btn-ghost self-end">Ajouter / modifier</button></form></section></div></div>
  );
}
