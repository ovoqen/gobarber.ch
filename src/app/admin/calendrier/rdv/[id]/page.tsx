import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { requireStaff, canEditCalendar } from "@/lib/auth";
import { fmtDateTime, TZ } from "@/modules/slots";
import { chf } from "@/modules/pricing";
import { Alert, Field, StatusBadge } from "@/components/ui";
import { ConfirmForm } from "@/components/Confirm";
import { rescheduleAction, cancelFromCalendar } from "../../../actions";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; ok?: string }> }) {
  const u = await requireStaff("bookings.manage"); const sp = await searchParams;
  const b = await db.booking.findUnique({ where: { id: (await params).id }, include: { items: true, partner: { select: { displayName: true } }, client: { select: { firstName: true, lastName: true, email: true, phone: true } } } }); if (!b) notFound();
  const edit = canEditCalendar(u), open = ["REQUESTED", "ACCEPTED"].includes(b.status), z = DateTime.fromJSDate(b.startsAt, { zone: TZ });
  const guest = b.client.email.endsWith("@gobarber.invalid");
  const prior = b.status === "CANCELLED" && b.cancelledBy === "CLIENT" ? await db.booking.count({ where: { clientId: b.clientId, cancelledBy: "CLIENT", status: "CANCELLED" } }) : 0;
  return (
    <div className="mx-auto max-w-2xl space-y-5"><Link href="/admin/calendrier" className="text-sm underline">← Calendrier</Link>
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-4xl">{b.number}</h1><StatusBadge status={b.status} /></div>
      {sp.e && <Alert kind="error">{sp.e}</Alert>}{sp.ok && <Alert kind="ok">{sp.ok}</Alert>}
      <section className="card space-y-1 text-sm"><p><strong>Quand :</strong> {fmtDateTime(b.startsAt)} ({Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60000)} min)</p><p><strong>Barbier :</strong> {b.partner.displayName}</p>
        <p><strong>Client :</strong> {b.client.firstName} {guest ? "(invité)" : b.client.lastName}{!guest && ` · ${b.client.email}`}{b.client.phone && ` · ${b.client.phone}`}</p><p><strong>Personnes :</strong> {b.people}</p><p><strong>Adresse :</strong> {b.street}, {b.zip} {b.city}</p>
        <p><strong>Origine :</strong> {b.source === "MANUAL" ? "ajouté à la main (payé hors plateforme)" : "réservation en ligne"}</p>
        <ul className="border-t border-line pt-2">{b.items.map((i) => <li key={i.id}>{i.quantity > 1 ? `${i.quantity} × ` : ""}{i.name} · {chf(i.priceCents * i.quantity)}</li>)}</ul><p className="border-t border-line pt-2 font-semibold">Total {chf(b.totalCents)}</p>
        {b.status === "CANCELLED" && <p className="text-bad">Annulé par {b.cancelledBy === "CLIENT" ? "le client" : b.cancelledBy === "PARTNER" ? "le barbier" : "la plateforme"}{b.cancelledAt && ` le ${b.cancelledAt.toLocaleString("fr-CH", { timeZone: TZ })}`} — {b.cancelReason}{prior > 1 && <strong> · {prior} annulations de ce client au total</strong>}</p>}</section>
      {open && !edit && <Alert>Vous pouvez consulter ce rendez-vous, mais pas le modifier. Demandez le droit à un administrateur.</Alert>}
      {open && edit && (<>
        <ConfirmForm action={rescheduleAction} message="Déplacer ce rendez-vous ? Le client et le barbier seront prévenus." className="card space-y-3"><h2 className="text-2xl">Déplacer</h2><input type="hidden" name="id" value={b.id} />
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Nouvelle date" name="date" type="date" defaultValue={z.toISODate()} required /><Field label="Nouvelle heure" name="time" type="time" step={300} defaultValue={z.toFormat("HH:mm")} required /></div><button className="btn-dark">Déplacer le rendez-vous</button></ConfirmForm>
        <ConfirmForm action={cancelFromCalendar} message="Annuler ce rendez-vous ? Un éventuel paiement en ligne est remboursé intégralement." className="card space-y-3"><h2 className="text-2xl">Annuler</h2><input type="hidden" name="id" value={b.id} />
          <Field label="Motif (obligatoire)" name="reason" required /><button className="btn-danger">Annuler ce rendez-vous</button></ConfirmForm></>)}
      <p className="text-sm"><Link href={`/admin/reservations?q=${b.number}`} className="underline">Voir la réservation complète (paiement, réclamation)</Link></p>
    </div>
  );
}
