import { db } from "@/lib/db";
import { requireCalendarEditor } from "@/lib/auth";
import { Alert } from "@/components/ui";
import { ManualBookingForm } from "@/components/ManualBookingForm";
import { createManualAction } from "../../actions";
export const metadata = { title: "Nouveau rendez-vous" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ p?: string; e?: string }> }) {
  await requireCalendarEditor(); const sp = await searchParams;
  const partners = await db.partner.findMany({ where: { status: "APPROVED" }, include: { services: { where: { active: true }, include: { service: true } } }, orderBy: { displayName: "asc" } });
  const cur = partners.find((x) => x.id === sp.p);
  return (
    <div className="mx-auto max-w-2xl space-y-5"><div><p className="eyebrow mb-2">Calendrier</p><h1 className="text-4xl">Nouveau rendez-vous</h1></div>
      {sp.e && <Alert kind="error">{sp.e}</Alert>}
      {!cur ? (
        <form className="card space-y-4"><label htmlFor="p" className="lbl">Pour quel barbier ?</label><select id="p" name="p" required className="field">{partners.map((x) => <option key={x.id} value={x.id}>{x.displayName}</option>)}</select>{!partners.length && <p className="text-sm text-muted">Aucun barbier actif.</p>}<button className="btn-dark">Continuer</button></form>
      ) : <ManualBookingForm askClientEmail action={createManualAction} cancelHref="/admin/calendrier" partner={{ id: cur.id, name: cur.displayName, services: cur.services.map((s) => ({ id: s.serviceId, name: s.service.name, priceCents: s.priceCents, durationMin: s.durationMin })) }} />}
    </div>
  );
}
