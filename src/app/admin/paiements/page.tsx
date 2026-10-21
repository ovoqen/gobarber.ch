import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { chf } from "@/modules/pricing";
import { Alert } from "@/components/ui";
import { ConfirmForm } from "@/components/Confirm";
import { payoutsAction } from "../actions";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireStaff("payments.manage");
  const [pays, payouts, sums] = await Promise.all([db.payment.findMany({ include: { booking: { select: { number: true } } }, orderBy: { createdAt: "desc" }, take: 60 }), db.payout.findMany({ include: { partner: { select: { displayName: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.payment.aggregate({ _sum: { capturedCents: true, refundedCents: true } })]);
  const comm = await db.booking.aggregate({ where: { status: { in: ["COMPLETED", "NO_SHOW_CLIENT"] } }, _sum: { commissionCents: true } });
  return (
    <div className="space-y-6"><h1 className="text-3xl font-semibold">Paiements, commissions, versements</h1>{(await searchParams).ok && <Alert kind="ok">{(await searchParams).ok}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">{[["Encaissé", sums._sum.capturedCents ?? 0], ["Remboursé", sums._sum.refundedCents ?? 0], ["Commissions (prestations réalisées)", comm._sum.commissionCents ?? 0]].map(([l, v]) => <div key={l as string} className="card"><p className="text-sm text-muted">{l}</p><p className="text-2xl font-semibold">{chf(v as number)}</p></div>)}</div>
      <div className="flex flex-wrap gap-2"><ConfirmForm action={payoutsAction} message="Lancer les versements aux barbiers pour toutes les prestations éligibles ?"><button className="btn-dark">Lancer les versements</button></ConfirmForm><a href="/api/admin/export" className="btn-ghost">Export comptable (CSV)</a></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Réservation</th><th>Fournisseur</th><th>Statut</th><th className="text-right">Montant</th><th className="text-right">Encaissé</th><th className="text-right">Remboursé</th></tr></thead><tbody>{pays.map((p) => <tr key={p.id} className="border-b border-line"><td className="py-2">{p.booking.number}</td><td>{p.provider}</td><td>{p.status}</td><td className="text-right">{chf(p.amountCents)}</td><td className="text-right">{chf(p.capturedCents)}</td><td className="text-right">{chf(p.refundedCents)}</td></tr>)}</tbody></table></div>
      <h2 className="text-xl font-semibold">Versements</h2><ul className="text-sm">{payouts.map((p) => <li key={p.id}>{p.createdAt.toLocaleDateString("fr-CH")} — {p.partner.displayName} — {chf(p.amountCents)} — {p.status}</li>)}{!payouts.length && <li className="text-muted">Aucun.</li>}</ul></div>
  );
}
