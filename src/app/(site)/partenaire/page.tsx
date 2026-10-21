import Link from "next/link";
import { db } from "@/lib/db";
import { requirePartner } from "@/lib/auth";
import { expireStale } from "@/lib/booking-service";
import { fmtDateTime } from "@/modules/slots";
import { chf } from "@/modules/pricing";
import { Alert, PageTitle } from "@/components/ui";
import { CalendarWeek, weekStartFrom } from "@/components/CalendarWeek";
import { PNav } from "./PartnerNav";
import { respondAction, toggleInstant } from "./actions";
export const metadata = { title: "Mon calendrier" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; s?: string; ok?: string }> }) {
  const u = await requirePartner(); await expireStale(); const sp = await searchParams;
  const p = u.partner, ws = weekStartFrom(sp.s);
  if (p.status !== "APPROVED") return (
    <div className="container-x py-10"><PageTitle title="Mon calendrier" /><PNav current="/partenaire" />
      <Alert>{p.status === "DRAFT" ? <>Votre profil n'est pas encore envoyé. <Link className="underline" href="/partenaire/profil">Complétez-le et envoyez votre candidature.</Link></> : p.status === "PENDING" ? "Votre candidature est en cours de vérification par l'équipe GoBarber.ch." : p.status === "SUSPENDED" ? `Compte suspendu. ${p.statusNote ?? ""} Contactez l'assistance.` : `Candidature refusée. ${p.statusNote ?? ""}`}</Alert></div>);

  const from = ws.toJSDate(), to = ws.plus({ weeks: 1 }).toJSDate();
  const [pending, week, offs, rules] = await Promise.all([
    db.booking.findMany({ where: { partnerId: p.id, status: "REQUESTED" }, include: { items: true, client: { select: { firstName: true } } }, orderBy: { responseDeadline: "asc" } }),
    db.booking.findMany({ where: { partnerId: p.id, startsAt: { gte: from, lt: to }, OR: [{ status: { in: ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "NO_SHOW_CLIENT"] } }, { status: "CANCELLED", cancelledBy: "CLIENT" }] }, include: { items: true, client: { select: { firstName: true } } } }),
    db.timeOff.findMany({ where: { partnerId: p.id, endsAt: { gt: from }, startsAt: { lt: to } } }),
    db.availabilityRule.findMany({ where: { partnerId: p.id } }),
  ]);
  const live = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];
  return (
    <div className="container-x py-10">
      <PageTitle title="Mon calendrier" /><PNav current="/partenaire" />
      {sp.e && <div className="mb-4"><Alert kind="error">{sp.e}</Alert></div>}
      {sp.ok && <div className="mb-4"><Alert kind="ok">Rendez-vous {sp.ok} ajouté.</Alert></div>}

      {pending.length > 0 && (
        <section aria-label="Demandes à traiter" className="mb-8 space-y-3">
          <h2 className="text-2xl">{pending.length} demande{pending.length > 1 ? "s" : ""} à traiter</h2>
          {pending.map((b) => (
            <div key={b.id} className="card flex flex-wrap items-center justify-between gap-4 !border-gold/60">
              <div><p className="font-display text-2xl">{fmtDateTime(b.startsAt)}</p><p className="text-sm text-muted">{b.people > 1 ? `${b.people} personnes · ` : ""}{b.items.map((i) => (i.quantity > 1 ? `${i.quantity}× ` : "") + i.name).join(" + ")} · {b.zip} {b.city} · vous percevez {chf(b.partnerNetCents)}</p>
                <p className="text-sm text-gold">Répondre avant {b.responseDeadline?.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" })} — sinon la demande expire sans frais.</p></div>
              <div className="flex gap-2"><form action={respondAction.bind(null, b.id, true)}><button className="btn-gold">Accepter</button></form><form action={respondAction.bind(null, b.id, false)}><button className="btn-ghost">Refuser</button></form></div>
            </div>))}
        </section>)}

      <CalendarWeek weekStart={ws} baseHref="/partenaire" newHref={p.canManageCalendar ? "/partenaire/nouveau-rdv" : undefined} offs={offs.map((o) => ({ start: o.startsAt, end: o.endsAt }))} rules={rules}
        events={week.map((b) => ({ id: b.id, start: b.startsAt, end: b.endsAt, title: `${b.client.firstName}${live.includes(b.status) ? "" : ""}`, sub: b.status === "CANCELLED" ? "Annulé par le client" : `${b.people > 1 ? `${b.people} pers. · ` : ""}${b.items.map((i) => (i.quantity > 1 ? `${i.quantity}× ` : "") + i.name).join(" + ")} · ${live.includes(b.status) ? b.street : b.city}`, status: b.status, href: `/partenaire/reservations/${b.id}` }))} />

      <form action={toggleInstant} className="card mt-8 flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Demandes « dès que possible » : {p.instantEnabled ? "activées" : "désactivées"}</p><p className="text-sm text-muted">Activées : les clients peuvent vous réserver tout de suite quand vous êtes libre.</p></div>
        <input type="hidden" name="on" value={p.instantEnabled ? "0" : "1"} /><button className={p.instantEnabled ? "btn-ghost" : "btn-gold"}>{p.instantEnabled ? "Désactiver" : "Activer"}</button></form>
    </div>
  );
}
