import Link from "next/link";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { expireStale } from "@/lib/booking-service";
import { fmtDateTime } from "@/modules/slots";
import { chf } from "@/modules/pricing";
import { isTerminal } from "@/modules/booking-state";
import { NavTabs, PageTitle, StatusBadge, Alert } from "@/components/ui";
import { Kpi } from "@/components/dash";
export const metadata = { title: "Mon compte" };
export const dynamic = "force-dynamic";
export default async function Page() {
  const u = await requireClient(); await expireStale();
  const [bookings, notifs] = await Promise.all([
    db.booking.findMany({ where: { clientId: u.id }, include: { partner: { select: { displayName: true } } }, orderBy: { startsAt: "desc" }, take: 50 }),
    db.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const up = bookings.filter((b) => !isTerminal(b.status)).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()), past = bookings.filter((b) => isTerminal(b.status));
  const row = (b: (typeof bookings)[number]) => (
    <li key={b.id}><Link href={`/compte/reservations/${b.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-gold">
      <div><p className="font-semibold">{b.partner.displayName}</p><p className="text-sm text-muted">{fmtDateTime(b.startsAt)} · {b.number}</p></div><div className="flex items-center gap-3"><span className="text-sm">{chf(b.totalCents)}</span><StatusBadge status={b.status} /></div></Link></li>
  );
  return (
    <div className="container-x py-10">
      <PageTitle title={`Bonjour ${u.firstName}`} />
      <NavTabs current="/compte" items={[["/compte", "Mes réservations"], ["/compte/profil", "Profil et confidentialité"]]} />
      {!u.emailVerifiedAt && <div className="mb-4"><Alert>Confirmez votre adresse e-mail (lien envoyé à l'inscription) pour pouvoir réserver.</Alert></div>}
      <div className="mb-6 grid gap-3 sm:grid-cols-3"><Kpi label="Prochain rendez-vous" value={up[0] ? up[0].startsAt.toLocaleDateString("fr-CH", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Zurich" }) : "—"} hint={up[0] ? `${up[0].partner.displayName} · ${up[0].startsAt.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" })}` : "Aucun rendez-vous prévu"} accent /><Kpi label="En cours" value={String(up.length)} hint="réservations actives" /><Kpi label="Terminées" value={String(past.filter((b) => b.status === "COMPLETED").length)} hint="prestations réalisées" /></div>
      <Link href="/reserver" className="btn-gold mb-6">Nouvelle réservation</Link>
      <h2 className="mb-3 text-xl font-semibold">À venir et en cours</h2>
      <ul className="mb-8 space-y-3">{up.length ? up.map(row) : <li className="text-muted">Aucune réservation en cours.</li>}</ul>
      <h2 className="mb-3 text-xl font-semibold">Historique</h2>
      <ul className="space-y-3">{past.length ? past.map(row) : <li className="text-muted">Rien pour l'instant.</li>}</ul>
      {notifs.length > 0 && <><h2 className="mb-3 mt-8 text-xl font-semibold">Notifications récentes</h2><ul className="space-y-2 text-sm">{notifs.map((n) => <li key={n.id} className="card !p-3"><strong>{n.title}</strong> — {n.body}</li>)}</ul></>}
    </div>
  );
}
