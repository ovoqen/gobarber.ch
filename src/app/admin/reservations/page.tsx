import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { fmtDateTime } from "@/modules/slots";
import { chf } from "@/modules/pricing";
import { Alert, StatusBadge } from "@/components/ui";
import { ConfirmForm } from "@/components/Confirm";
import { isTerminal } from "@/modules/booking-state";
import { adminCancel, resolveDispute } from "../actions";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string; q?: string; s?: string }> }) {
  await requireStaff("bookings.manage"); const sp = await searchParams;
  const list = await db.booking.findMany({ where: { ...(sp.s ? { status: sp.s } : {}), ...(sp.q ? { number: { contains: sp.q.trim().toUpperCase() } } : {}) }, include: { client: { select: { email: true } }, partner: { select: { displayName: true } }, dispute: true, payments: true }, orderBy: [{ createdAt: "desc" }], take: 100 });
  list.sort((a, b) => Number(b.dispute?.status === "OPEN") - Number(a.dispute?.status === "OPEN"));
  return (
    <div className="space-y-4"><h1 className="text-3xl font-semibold">Réservations</h1>{sp.ok && <Alert kind="ok">{sp.ok}</Alert>}{sp.e && <Alert kind="error">{sp.e}</Alert>}
      <form className="flex flex-wrap gap-2"><input name="q" defaultValue={sp.q} placeholder="N° GB-…" className="field max-w-xs" /><select name="s" defaultValue={sp.s ?? ""} className="field max-w-xs"><option value="">Tous statuts</option>{["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REFUSED", "EXPIRED", "NO_SHOW_CLIENT"].map((s) => <option key={s}>{s}</option>)}</select><button className="btn-ghost">Filtrer</button></form>
      {list.map((b) => (
        <article key={b.id} className="card space-y-2 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{b.number} · {fmtDateTime(b.startsAt)}</p><StatusBadge status={b.status} /></div>
          <p>{b.client.email} → {b.partner.displayName} · {chf(b.totalCents)} (commission {chf(b.commissionCents)}) · paiement {b.payments[0]?.status} · {b.zip} {b.city}</p>
          {b.dispute && <div className="rounded-lg bg-gold-100 p-3"><p><strong>Réclamation ({b.dispute.status}) :</strong> {b.dispute.reason}</p>{b.dispute.resolution && <p>Décision : {b.dispute.resolution}</p>}
            {b.dispute.status === "OPEN" && <ConfirmForm action={resolveDispute} message="Clôturer la réclamation ? Le remboursement saisi sera exécuté immédiatement." className="mt-2 flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={b.id} /><div><label className="lbl" htmlFor={`r${b.id}`}>Remboursement CHF (max {(b.payments[0].capturedCents - b.payments[0].refundedCents) / 100})</label><input id={`r${b.id}`} name="refund" type="number" step="0.05" min={0} defaultValue={0} className="field w-32" /></div><input name="reason" required minLength={5} placeholder="Décision motivée" className="field max-w-xs" /><button className="btn-dark">Clôturer</button></ConfirmForm>}</div>}
          {!isTerminal(b.status) && <ConfirmForm action={adminCancel} message="Annuler cette réservation et rembourser intégralement le client ?" className="flex flex-wrap gap-2"><input type="hidden" name="id" value={b.id} /><input name="reason" required minLength={5} placeholder="Motif de l'annulation" className="field max-w-xs" /><button className="btn-danger">Annuler + rembourser</button></ConfirmForm>}</article>))}
      {!list.length && <p className="text-muted">Aucune réservation.</p>}</div>
  );
}
