import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { Alert } from "@/components/ui";
import { saveService } from "../actions";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  await requireStaff("catalog.manage"); const sp = await searchParams; const list = await db.service.findMany({ orderBy: { sort: "asc" } });
  const form = (s?: (typeof list)[number]) => (
    <form key={s?.id ?? "new"} action={saveService} className="card grid items-end gap-2 text-sm sm:grid-cols-[6rem_1fr_1fr_5rem_5rem_4rem_auto_auto]">{s && <input type="hidden" name="id" value={s.id} />}
      <div><label className="lbl">Code</label><input name="code" defaultValue={s?.code} required className="field" /></div><div><label className="lbl">Nom</label><input name="name" defaultValue={s?.name} required className="field" /></div><div><label className="lbl">Description</label><input name="description" defaultValue={s?.description} className="field" /></div>
      <div><label className="lbl">CHF</label><input name="price" type="number" step="0.5" defaultValue={s ? s.priceCents / 100 : 45} className="field" /></div><div><label className="lbl">Min</label><input name="duration" type="number" defaultValue={s?.durationMin ?? 30} className="field" /></div><div><label className="lbl">Ordre</label><input name="sort" type="number" defaultValue={s?.sort ?? 0} className="field" /></div>
      <label className="flex items-center gap-1 pb-3"><input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="size-5" />Actif</label><button className="btn-dark">{s ? "OK" : "Créer"}</button></form>);
  return <div className="space-y-4"><h1 className="text-3xl font-semibold">Catalogue des prestations</h1><p className="text-sm text-muted">Prix et durées = valeurs indicatives ; chaque barbier fixe les siens. Zones et frais de déplacement sont définis par barbier (espace partenaire).</p>{sp.ok && <Alert kind="ok">{sp.ok}</Alert>}{sp.e && <Alert kind="error">{sp.e}</Alert>}{list.map(form)}<h2 className="pt-4 text-xl font-semibold">Nouvelle prestation</h2>{form()}</div>;
}
