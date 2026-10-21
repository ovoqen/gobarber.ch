import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { fmtDateTime, TZ } from "@/modules/slots";
import { chf } from "@/modules/pricing";
import { Kpi } from "@/components/dash";
export const metadata = { title: "Annulations" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff("bookings.manage"); const sp = await searchParams;
  const list = await db.booking.findMany({ where: { status: "CANCELLED", cancelledBy: "CLIENT", ...(sp.q ? { OR: [{ number: { contains: sp.q.toUpperCase() } }, { client: { email: { contains: sp.q.toLowerCase() } } }, { client: { firstName: { contains: sp.q } } }] } : {}) }, include: { client: { select: { id: true, firstName: true, lastName: true, email: true } }, partner: { select: { displayName: true } } }, orderBy: { cancelledAt: "desc" }, take: 200 });
  const all = await db.booking.groupBy({ by: ["clientId"], where: { status: "CANCELLED", cancelledBy: "CLIENT" }, _count: { _all: true } });
  const n = new Map(all.map((g) => [g.clientId, g._count._all])), since = new Date(Date.now() - 30 * 86_400_000);
  const last30 = list.filter((b) => (b.cancelledAt ?? b.createdAt) >= since).length, repeat = [...n.values()].filter((v) => v >= 3).length, kept = list.reduce((a, b) => a + (b.totalCents - b.refundCents), 0);
  return (
    <div className="space-y-6"><div><p className="eyebrow mb-2">Suivi des clients</p><h1 className="text-4xl">Annulations de clients</h1></div>
      <div className="grid gap-3 sm:grid-cols-3"><Kpi label="Sur 30 jours" value={String(last30)} hint="annulations par des clients" accent /><Kpi label="Clients récidivistes" value={String(repeat)} hint="3 annulations ou plus" /><Kpi label="Frais retenus" value={chf(kept)} hint="annulations tardives (liste ci-dessous)" /></div>
      <form className="flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Chercher un client, un e-mail ou un n°" className="field max-w-sm" /><button className="btn-ghost">Chercher</button></form>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Annulé le</th><th>Client</th><th>Rendez-vous</th><th>Barbier</th><th>Motif</th><th className="text-right">Retenu</th><th className="text-right">Historique du client</th></tr></thead>
        <tbody>{list.map((b) => { const c = n.get(b.clientId) ?? 1; return (
          <tr key={b.id} className="border-b border-line align-top"><td className="whitespace-nowrap py-3">{b.cancelledAt?.toLocaleString("fr-CH", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }) ?? "—"}</td>
            <td>{b.client.firstName} {b.client.lastName}<span className="block text-xs text-muted">{b.client.email}</span></td>
            <td><Link href={`/admin/calendrier/rdv/${b.id}`} className="underline">{b.number}</Link><span className="block text-xs text-muted">{fmtDateTime(b.startsAt)}</span></td><td>{b.partner.displayName}</td><td className="max-w-xs text-muted">{b.cancelReason}</td>
            <td className="text-right">{chf(b.totalCents - b.refundCents)}</td>
            <td className="text-right"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c >= 3 ? "bg-bad/20 text-bad" : c === 2 ? "bg-gold-100 text-gold-600" : "bg-white/10"}`}>{c} annulation{c > 1 ? "s" : ""}{c >= 3 ? " · à surveiller" : ""}</span></td></tr>); })}</tbody></table>
        {!list.length && <p className="py-6 text-muted">Aucune annulation de client.</p>}</div></div>
  );
}
