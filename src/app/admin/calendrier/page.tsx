import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff, canEditCalendar } from "@/lib/auth";
import { Alert } from "@/components/ui";
import { CalendarWeek, weekStartFrom } from "@/components/CalendarWeek";
export const metadata = { title: "Calendrier" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string; p?: string; e?: string; ok?: string }> }) {
  const u = await requireStaff("bookings.manage"); const sp = await searchParams, ws = weekStartFrom(sp.s), edit = canEditCalendar(u);
  const partners = await db.partner.findMany({ where: { status: "APPROVED" }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" } });
  const pid = partners.find((x) => x.id === sp.p)?.id, from = ws.toJSDate(), to = ws.plus({ weeks: 1 }).toJSDate();
  const [week, offs, rules] = await Promise.all([
    db.booking.findMany({ where: { ...(pid ? { partnerId: pid } : {}), startsAt: { gte: from, lt: to }, OR: [{ status: { in: ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "NO_SHOW_CLIENT"] } }, { status: "CANCELLED", cancelledBy: "CLIENT" }] }, include: { items: true, partner: { select: { displayName: true } }, client: { select: { firstName: true } } } }),
    pid ? db.timeOff.findMany({ where: { partnerId: pid, endsAt: { gt: from }, startsAt: { lt: to } } }) : [],
    pid ? db.availabilityRule.findMany({ where: { partnerId: pid } }) : [],
  ]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow mb-2">Tous les rendez-vous</p><h1 className="text-4xl">Calendrier</h1></div>
        <form className="flex items-center gap-2"><input type="hidden" name="s" value={ws.toISODate()!} /><label htmlFor="p" className="text-sm text-muted">Barbier</label>
          <select id="p" name="p" defaultValue={pid ?? ""} className="field !w-auto"><option value="">Tous</option>{partners.map((x) => <option key={x.id} value={x.id}>{x.displayName}</option>)}</select><button className="btn-ghost">Afficher</button></form></div>
      {sp.ok && <Alert kind="ok">{sp.ok}</Alert>}{sp.e && <Alert kind="error">{sp.e}</Alert>}
      {!edit && <Alert>Vous pouvez consulter le calendrier. L'ajout, le déplacement et l'annulation sont réservés aux personnes autorisées par un administrateur.</Alert>}
      <CalendarWeek weekStart={ws} baseHref="/admin/calendrier" extraQuery={pid ? `&p=${pid}` : ""} newHref={edit ? `/admin/calendrier/nouveau${pid ? `?p=${pid}` : ""}` : undefined} offs={offs.map((o) => ({ start: o.startsAt, end: o.endsAt }))} rules={rules}
        events={week.map((b) => ({ id: b.id, start: b.startsAt, end: b.endsAt, title: pid ? b.client.firstName : `${b.partner.displayName} · ${b.client.firstName}`, sub: `${b.status === "CANCELLED" ? "Annulé par le client" : `${b.people > 1 ? `${b.people} pers. · ` : ""}${b.items.map((i) => (i.quantity > 1 ? `${i.quantity}× ` : "") + i.name).join(" + ")}`} · ${b.city}`, status: b.status, href: `/admin/calendrier/rdv/${b.id}` }))} />
      <p className="text-sm text-muted"><Link href="/admin/annulations" className="underline">Voir la liste des annulations de clients</Link></p>
    </div>
  );
}
