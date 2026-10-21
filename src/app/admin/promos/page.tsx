import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { Alert, Field } from "@/components/ui";
import { savePromo, togglePromo } from "../actions";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  await requireStaff("promos.manage"); const sp = await searchParams; const list = await db.promoCode.findMany({ orderBy: { code: "asc" } });
  return <div className="space-y-4"><h1 className="text-3xl font-semibold">Codes promotionnels</h1>{sp.ok && <Alert kind="ok">{sp.ok}</Alert>}{sp.e && <Alert kind="error">{sp.e}</Alert>}
    <ul className="space-y-2 text-sm">{list.map((p) => <li key={p.id} className="card flex flex-wrap items-center justify-between gap-2"><span><strong>{p.code}</strong> — {p.percentOff ? `${p.percentOff} %` : `CHF ${(p.amountOffCents ?? 0) / 100}`} · utilisé {p.usedCount}{p.maxUses ? `/${p.maxUses}` : ""} · {p.active ? "actif" : "inactif"}</span><form action={togglePromo}><input type="hidden" name="id" value={p.id} /><button className="btn-ghost">{p.active ? "Désactiver" : "Activer"}</button></form></li>)}</ul>
    <form action={savePromo} className="card grid items-end gap-3 sm:grid-cols-5"><Field label="Code" name="code" required /><Field label="Remise %" name="percent" type="number" defaultValue={0} /><Field label="ou montant CHF" name="amount" type="number" step={0.5} defaultValue={0} /><Field label="Utilisations max (0 = illimité)" name="max" type="number" defaultValue={0} /><button className="btn-dark">Créer / modifier</button></form></div>;
}
