import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { expireStale } from "@/lib/booking-service";
import { getSettings, toPolicy } from "@/lib/settings";
import { computeCancellation } from "@/modules/cancellation";
import { fmtDateTime } from "@/modules/slots";
import { chf } from "@/modules/pricing";
import { STATUS_LABEL, isTerminal } from "@/modules/booking-state";
import { Alert, StatusBadge } from "@/components/ui";
import { PayPanel, WaitForConfirmation } from "./PayPanel";
import { cancelAction, sendMessage, submitReview, openDispute, reportMessage } from "../../actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Réservation" };

const TIMELINE = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"] as const;

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; ok?: string; paid?: string }> }) {
  const u = await requireClient(); await expireStale();
  const sp = await searchParams;
  // Filtre par propriétaire : un autre client obtient un 404 (aucune fuite d'existence).
  const b = await db.booking.findFirst({ where: { id: (await params).id, clientId: u.id }, include: { items: true, partner: true, payments: true, review: true, dispute: true, messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { firstName: true, id: true } } } } } });
  if (!b) notFound();
  const settings = await getSettings();
  const preview = !isTerminal(b.status) ? computeCancellation({ by: "CLIENT", status: b.status, totalCents: b.totalCents, travelFeeCents: b.travelFeeCents, startsAt: b.startsAt, acceptedAt: b.acceptedAt, now: new Date(), policy: toPolicy(settings) }) : null;
  const idx = TIMELINE.indexOf(b.status as never);
  const demo = (process.env.PAYMENT_PROVIDER ?? "demo") === "demo";
  const canChat = !["PENDING_PAYMENT", "REFUSED", "EXPIRED"].includes(b.status);
  return (
    <div className="container-x max-w-3xl space-y-6 py-10">
      <Link href="/compte" className="text-sm underline">← Mes réservations</Link>
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-3xl font-semibold">Réservation {b.number}</h1><StatusBadge status={b.status} /></div>
      {sp.ok && <Alert kind="ok">{sp.ok}</Alert>}{sp.e && <Alert kind="error">{sp.e}</Alert>}

      {b.status === "PENDING_PAYMENT" && (sp.paid ? <WaitForConfirmation /> : <PayPanel id={b.id} total={chf(b.totalCents)} demo={demo} />)}
      {b.paymentMode === "ON_SITE" && !isTerminal(b.status) && <Alert>Paiement <strong>sur place</strong>, directement au barbier ({chf(b.totalCents)}). Aucun montant n'est prélevé en ligne.</Alert>}
      {["REFUSED", "EXPIRED"].includes(b.status) && <Alert>{b.status === "REFUSED" ? "Le barbier a refusé la demande." : "Le barbier n'a pas répondu à temps."} Aucun montant n'a été débité. <Link href="/reserver" className="underline">Réserver à nouveau</Link></Alert>}

      {idx >= 0 && <ol className="grid grid-cols-5 gap-1 text-center text-xs" aria-label="Suivi">{TIMELINE.map((s, i) => <li key={s} aria-current={i === idx ? "step" : undefined} className={`rounded-lg px-1 py-2 ${i <= idx ? "bg-ink text-white" : "border border-line bg-white text-muted"}`}>{STATUS_LABEL[s]}</li>)}</ol>}
      {b.status === "REQUESTED" && b.responseDeadline && <p className="text-sm text-muted">Réponse attendue avant {b.responseDeadline.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" })}. Sans réponse, la demande expire sans frais.</p>}

      <section className="card space-y-2 text-sm">
        <h2 className="text-xl font-semibold">Détails</h2>
        <p><strong>Barbier :</strong> {b.partner.displayName}</p><p><strong>Quand :</strong> {fmtDateTime(b.startsAt)}</p><p><strong>Personnes :</strong> {b.people}</p><p><strong>Adresse :</strong> {b.street}, {b.zip} {b.city}{b.access ? ` (${b.access})` : ""}</p>
        <ul className="border-t border-line pt-2">{b.items.map((i) => <li key={i.id} className="flex justify-between"><span>{i.quantity > 1 ? `${i.quantity} × ` : ""}{i.name} · {i.durationMin} min{i.quantity > 1 ? " chacune" : ""}</span><span>{chf(i.priceCents * i.quantity)}</span></li>)}
          {b.discountCents > 0 && <li className="flex justify-between text-ok"><span>Remise {b.promoCode}</span><span>− {chf(b.discountCents)}</span></li>}
          <li className="flex justify-between"><span>Frais de déplacement</span><span>{chf(b.travelFeeCents)}</span></li><li className="flex justify-between border-t border-line pt-1 text-base font-semibold"><span>Total</span><span>{chf(b.totalCents)}</span></li></ul>
        {b.refundCents > 0 && <p className="text-ok">Remboursé / non débité : {chf(b.refundCents)}</p>}
        {["COMPLETED", "NO_SHOW_CLIENT"].includes(b.status) && <Link href={`/compte/reservations/${b.id}/recu`} className="btn-ghost mt-2">Voir le reçu</Link>}
      </section>

      {preview && (
        <section className="card space-y-3"><h2 className="text-xl font-semibold">Annuler</h2>
          <p className="text-sm">{preview.chargeCents > 0 ? <>Si vous annulez maintenant : <strong>{chf(preview.chargeCents)}</strong> retenus, {chf(preview.refundCents)} remboursés.</> : <>Si vous annulez maintenant : <strong>aucun frais</strong>.</>} <span className="text-muted">{preview.reason}</span></p>
          <form action={cancelAction} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={b.id} /><input name="reason" placeholder="Motif (facultatif)" className="field max-w-xs" /><button className="btn-danger">Annuler la réservation</button></form></section>
      )}

      {canChat && (
        <section className="card space-y-3"><h2 className="text-xl font-semibold">Messages</h2>
          <ul className="space-y-2 text-sm" aria-live="polite">{b.messages.length === 0 && <li className="text-muted">Aucun message. Utilisez la messagerie pour les consignes d'accès ou un retard — pas de coordonnées de paiement.</li>}
            {b.messages.map((m) => <li key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 ${m.sender.id === u.id ? "ml-auto bg-gold-100" : "bg-stone-100"}`}><span className="block text-xs text-muted">{m.sender.id === u.id ? "Vous" : b.partner.displayName} · {m.createdAt.toLocaleString("fr-CH", { timeZone: "Europe/Zurich", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>{m.body}{m.sender.id !== u.id && !m.flagged && <form action={reportMessage} className="mt-1"><input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={`/compte/reservations/${b.id}`} /><button className="text-xs underline opacity-70">Signaler</button></form>}</li>)}</ul>
          <form action={sendMessage} className="flex gap-2"><input type="hidden" name="id" value={b.id} /><label htmlFor="body" className="sr-only">Message</label><input id="body" name="body" required maxLength={1000} className="field" placeholder="Votre message…" /><button className="btn-dark">Envoyer</button></form></section>
      )}

      {b.status === "COMPLETED" && !b.review && (
        <section className="card space-y-3"><h2 className="text-xl font-semibold">Votre avis</h2>
          <form action={submitReview} className="space-y-3"><input type="hidden" name="id" value={b.id} />
            <fieldset><legend className="lbl">Note</legend><div className="flex gap-3">{[1, 2, 3, 4, 5].map((n) => <label key={n} className="flex items-center gap-1"><input type="radio" name="rating" value={n} required className="size-5" />{n}★</label>)}</div></fieldset>
            <div><label htmlFor="comment" className="lbl">Commentaire (facultatif)</label><textarea id="comment" name="comment" maxLength={800} rows={3} className="field" /></div><button className="btn-dark">Publier mon avis</button></form></section>
      )}
      {b.review && <section className="card text-sm"><h2 className="text-xl font-semibold">Votre avis</h2><p>{"★".repeat(b.review.rating)} {b.review.comment}</p></section>}

      {!b.dispute && !["PENDING_PAYMENT", "REFUSED", "EXPIRED"].includes(b.status) && (
        <details className="card"><summary className="cursor-pointer font-semibold">Un problème ? Ouvrir une réclamation / contacter l'assistance</summary>
          <form action={openDispute} className="mt-3 space-y-3"><input type="hidden" name="id" value={b.id} /><label htmlFor="reason" className="lbl">Décrivez le problème</label><textarea id="reason" name="reason" required minLength={10} maxLength={2000} rows={4} className="field" /><button className="btn-ghost">Envoyer à l'assistance</button></form></details>
      )}
      {b.dispute && <Alert>Réclamation {b.dispute.status === "OPEN" ? "en cours d'examen" : `clôturée : ${b.dispute.resolution ?? ""}`}.</Alert>}
    </div>
  );
}
