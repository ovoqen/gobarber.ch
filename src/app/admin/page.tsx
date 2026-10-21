import { DateTime } from "luxon";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { chf } from "@/modules/pricing";
import { Alert } from "@/components/ui";
import { Kpi, BarChart, Section } from "@/components/dash";
import AdminMap from "@/components/AdminMap";
import communes from "@/data/ge-communes.json";
export const dynamic = "force-dynamic";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+ge$/, "").replace(/œ/g, "oe").trim();

export default async function Page({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const u = await requireStaff();
  const since = DateTime.now().setZone("Europe/Zurich").minus({ days: 29 }).startOf("day");
  const [bookings, done, cancelled, partners, pendingP, disputes, zones, recent] = await Promise.all([
    db.booking.findMany({ where: { createdAt: { gte: since.toJSDate() }, status: { not: "PENDING_PAYMENT" } }, select: { createdAt: true, status: true, totalCents: true, commissionCents: true } }),
    db.booking.aggregate({ where: { status: "COMPLETED", completedAt: { gte: since.toJSDate() } }, _sum: { totalCents: true, commissionCents: true }, _count: true }),
    db.booking.count({ where: { createdAt: { gte: since.toJSDate() }, status: { in: ["CANCELLED", "REFUSED", "EXPIRED"] } } }),
    db.partner.count({ where: { status: "APPROVED" } }), db.partner.count({ where: { status: "PENDING" } }), db.dispute.count({ where: { status: "OPEN" } }),
    db.partnerZone.findMany({ where: { partner: { status: "APPROVED" } }, select: { city: true, partnerId: true } }),
    db.booking.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { partner: { select: { displayName: true } } } }),
  ]);
  const perDay = Array.from({ length: 30 }, (_, i) => { const d = since.plus({ days: i }); return { key: d.toISODate()!, label: d.toFormat("dd.LL"), value: 0 }; });
  for (const b of bookings) { const k = DateTime.fromJSDate(b.createdAt).setZone("Europe/Zurich").toISODate(); const r = perDay.find((p) => p.key === k); if (r) r.value++; }
  const counts: Record<string, number> = {};
  for (const c of communes) { const n = norm(c.name); counts[c.name] = new Set(zones.filter((z) => { const k = norm(z.city); return k === n || k.includes(n) || n.includes(k); }).map((z) => z.partnerId)).size; }
  const covered = Object.values(counts).filter((v) => v > 0).length, rate = bookings.length ? Math.round((cancelled / bookings.length) * 100) : 0;
  return (
    <div className="space-y-6">
      <div><p className="eyebrow mb-2">Vue d'ensemble · 30 derniers jours</p><h1 className="text-4xl sm:text-5xl">Bonjour, <span className="italic text-gold">{u.firstName}.</span></h1></div>
      {(await searchParams).denied && <Alert kind="error">Permission insuffisante.</Alert>}
      {(pendingP > 0 || disputes > 0) && <Alert>{pendingP > 0 && <><Link href="/admin/partenaires" className="underline">{pendingP} candidature(s) partenaire à vérifier</Link>. </>}{disputes > 0 && <><Link href="/admin/reservations" className="underline">{disputes} réclamation(s) ouverte(s)</Link>.</>}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Réservations" value={String(bookings.length)} hint="demandes envoyées" />
        <Kpi label="Chiffre d'affaires" value={chf(done._sum.totalCents ?? 0)} hint={`${done._count} prestations terminées`} accent />
        <Kpi label="Commissions" value={chf(done._sum.commissionCents ?? 0)} hint="sur prestations terminées" />
        <Kpi label="Annulations" value={`${rate} %`} hint="annulées, refusées, expirées" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Réservations par jour"><BarChart data={perDay.map(({ label, value }) => ({ label, value }))} title="Réservations par jour" /></Section>
        <Section title="Couverture du canton" aside={<span className="text-sm text-muted">{partners} barbier{partners > 1 ? "s" : ""} · {covered}/45 communes</span>}><AdminMap counts={counts} /></Section>
      </div>
      <Section title="Dernières réservations" aside={<Link href="/admin/reservations" className="text-sm text-gold underline">Tout voir</Link>}>
        <ul className="divide-y divide-white/10 text-sm">{recent.map((b) => <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><span><strong>{b.number}</strong> · {b.partner.displayName} · {b.zip} {b.city}</span><span className="text-muted">{chf(b.totalCents)} · {b.status}</span></li>)}{!recent.length && <li className="py-3 text-muted">Aucune réservation pour l'instant.</li>}</ul>
      </Section>
    </div>
  );
}
