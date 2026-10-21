import { db } from "@/lib/db";
import { requirePartner } from "@/lib/auth";
import { fmtDateTime } from "@/modules/slots";
import { chf } from "@/modules/pricing";
import { PageTitle, StatusBadge } from "@/components/ui";
import { PNav } from "../PartnerNav";
import { startConnect } from "../actions";
import { Alert } from "@/components/ui";
export const metadata = { title: "Revenus" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const sp = await searchParams;
  const u = await requirePartner(); const id = u.partner.id;
  const [done, payouts] = await Promise.all([
    db.booking.findMany({ where: { partnerId: id, completedAt: { not: null }, status: { in: ["COMPLETED", "NO_SHOW_CLIENT", "CANCELLED"] } }, orderBy: { completedAt: "desc" }, take: 100 }),
    db.payout.findMany({ where: { partnerId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const toPay = done.filter((b) => !b.payoutId).reduce((a, b) => a + b.partnerNetCents, 0), paid = payouts.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amountCents, 0), comm = done.reduce((a, b) => a + b.commissionCents, 0);
  return (
    <div className="container-x py-10"><PageTitle title="Revenus" /><PNav current="/partenaire/revenus" />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">{[["En attente de versement", toPay], ["Déjà versé", paid], ["Commissions prélevées", comm]].map(([l, v]) => <div key={l as string} className="card"><p className="text-sm text-muted">{l}</p><p className="text-2xl font-semibold">{chf(v as number)}</p></div>)}</div>
      {sp.e && <div className="mb-4"><Alert kind="error">{sp.e}</Alert></div>}{sp.ok && <div className="mb-4"><Alert kind="ok">Retour de Stripe : votre compte est en cours de vérification.</Alert></div>}
      <section className="card mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Versements : {u.partner.stripeStatus === "complete" ? "compte bancaire relié ✓" : u.partner.stripeStatus === "pending" ? "inscription Stripe incomplète" : "compte non relié"}</p><p className="text-sm text-muted">Vos gains sont versés sur votre compte via Stripe (identité et IBAN saisis chez Stripe, jamais chez GoBarber.ch). {u.partner.onlinePaymentEnabled ? "Le paiement en ligne est activé pour vous." : "Le paiement en ligne n'est pas activé pour vous : vos clients vous règlent sur place."}</p></div>{u.partner.stripeStatus !== "complete" && <form action={startConnect}><button className="btn-gold">{u.partner.stripeStatus === "pending" ? "Terminer l'inscription" : "Relier mon compte bancaire"}</button></form>}</section>
      <h2 className="mb-2 text-xl font-semibold">Prestations</h2>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Date</th><th>N°</th><th>Statut</th><th className="text-right">Total</th><th className="text-right">Commission</th><th className="text-right">Net</th><th>Versement</th></tr></thead>
        <tbody>{done.map((b) => <tr key={b.id} className="border-b border-line"><td className="py-2">{fmtDateTime(b.startsAt)}</td><td>{b.number}</td><td><StatusBadge status={b.status} /></td><td className="text-right">{chf(b.totalCents)}</td><td className="text-right">{chf(b.commissionCents)}</td><td className="text-right font-medium">{chf(b.partnerNetCents)}</td><td>{b.payoutId ? "versé" : "en attente"}</td></tr>)}</tbody></table></div>
      <h2 className="mb-2 mt-8 text-xl font-semibold">Versements</h2>
      <ul className="space-y-1 text-sm">{payouts.map((p) => <li key={p.id}>{p.createdAt.toLocaleDateString("fr-CH")} — {chf(p.amountCents)} — {p.status === "PAID" ? "payé" : p.status}</li>)}{!payouts.length && <li className="text-muted">Aucun versement.</li>}</ul>
    </div>
  );
}
