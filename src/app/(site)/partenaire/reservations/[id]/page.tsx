import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePartner } from "@/lib/auth";
import { fmtDateTime } from "@/modules/slots";
import { chf } from "@/modules/pricing";
import { Alert, StatusBadge } from "@/components/ui";
import { advanceAction, partnerCancel, partnerMessage, partnerReschedule } from "../../actions";
import { reportMessage } from "../../../compte/actions";
import { DateTime } from "luxon";
import { TZ } from "@/modules/slots";
export const dynamic = "force-dynamic";
export const metadata = { title: "Rendez-vous" };
const NEXT: Record<string, [string, string][]> = { ACCEPTED: [["EN_ROUTE", "Je suis en route"]], EN_ROUTE: [["IN_PROGRESS", "Prestation commencée"], ["NO_SHOW_CLIENT", "Client absent"]], IN_PROGRESS: [["COMPLETED", "Prestation terminée"]] };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string }> }) {
  const u = await requirePartner(); const sp = await searchParams;
  const b = await db.booking.findFirst({ where: { id: (await params).id, partnerId: u.partner.id }, include: { items: true, client: { select: { firstName: true, lastName: true, phone: true } }, messages: { orderBy: { createdAt: "asc" } } } });
  if (!b) notFound();
  // Adresse complète et téléphone : uniquement pendant la vie du rendez-vous accepté ; ensuite seule la commune reste visible.
  const canMove = !!u.partner.canManageCalendar && ["REQUESTED", "ACCEPTED"].includes(b.status), z = DateTime.fromJSDate(b.startsAt, { zone: TZ });
  const live = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"].includes(b.status);
  return (
    <div className="container-x max-w-3xl space-y-6 py-10"><Link href="/partenaire" className="text-sm underline">← Planning</Link>
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-3xl font-semibold">{b.number}</h1><StatusBadge status={b.status} /></div>
      {sp.e && <Alert kind="error">{sp.e}</Alert>}
      <section className="card space-y-1 text-sm"><p><strong>Quand :</strong> {fmtDateTime(b.startsAt)} ({Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60000)} min)</p>
        <p><strong>Personnes à coiffer :</strong> {b.people}</p>
        <p><strong>Client :</strong> {live ? `${b.client.firstName} ${b.client.lastName}${b.client.phone ? ` · ${b.client.phone}` : ""}` : b.client.firstName}</p>
        <p><strong>Adresse :</strong> {live ? `${b.street}, ${b.zip} ${b.city}${b.access ? ` — ${b.access}` : ""}` : `${b.zip} ${b.city} (adresse complète masquée)`}</p>
        <ul className="border-t border-line pt-2">{b.items.map((i) => <li key={i.id}>{i.quantity > 1 ? `${i.quantity} × ` : ""}{i.name} · {chf(i.priceCents * i.quantity)}</li>)}</ul>
        <p className="border-t border-line pt-2">Total client {chf(b.totalCents)} · commission {chf(b.commissionCents)} · <strong>vous percevez {chf(b.partnerNetCents)}</strong></p></section>
      {canMove && <form action={partnerReschedule} className="card space-y-3"><h2 className="text-2xl">Déplacer ce rendez-vous</h2><input type="hidden" name="id" value={b.id} /><div className="grid gap-3 sm:grid-cols-2"><div><label className="lbl" htmlFor="date">Nouvelle date</label><input id="date" name="date" type="date" required defaultValue={z.toISODate() ?? ""} className="field" /></div><div><label className="lbl" htmlFor="time">Nouvelle heure</label><input id="time" name="time" type="time" step={300} required defaultValue={z.toFormat("HH:mm")} className="field" /></div></div><p className="text-xs text-muted">Le client est prévenu automatiquement.</p><button className="btn-dark">Déplacer</button></form>}
      {NEXT[b.status] && <div className="flex flex-wrap gap-2">{NEXT[b.status].map(([to, l]) => <form key={to} action={advanceAction.bind(null, b.id, to)}><button className={to === "NO_SHOW_CLIENT" ? "btn-danger" : "btn-gold"}>{l}</button></form>)}</div>}
      {["ACCEPTED", "EN_ROUTE"].includes(b.status) && <form action={partnerCancel} className="card space-y-2"><p className="text-sm text-muted">Annuler après acceptation rembourse intégralement le client et peut entraîner une suspension en cas de répétition.</p><input type="hidden" name="id" value={b.id} /><input name="reason" required placeholder="Motif" className="field max-w-sm" /><button className="btn-danger">Annuler ce rendez-vous</button></form>}
      {b.status !== "REQUESTED" || b.messages.length ? (
        <section className="card space-y-3"><h2 className="text-xl font-semibold">Messages</h2><ul className="space-y-2 text-sm">{b.messages.map((m) => <li key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 ${m.senderId === u.id ? "ml-auto bg-gold-100" : "bg-stone-100"}`}>{m.body}{m.senderId !== u.id && !m.flagged && <form action={reportMessage} className="mt-1"><input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={`/partenaire/reservations/${b.id}`} /><button className="text-xs underline opacity-70">Signaler</button></form>}</li>)}{!b.messages.length && <li className="text-muted">Aucun message.</li>}</ul>
          <form action={partnerMessage} className="flex gap-2"><input type="hidden" name="id" value={b.id} /><label htmlFor="body" className="sr-only">Message</label><input id="body" name="body" required maxLength={1000} className="field" /><button className="btn-dark">Envoyer</button></form></section>) : null}
    </div>
  );
}
