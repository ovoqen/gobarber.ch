import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { nextSlots, partnerOffer } from "@/lib/booking-service";
import { getSettings } from "@/lib/settings";
import { computeTotals } from "@/modules/pricing";
import { isSwissZip } from "@/modules/zones";
import { rateLimit } from "@/lib/rate-limit";
import { paymentsReady } from "@/modules/payments/provider";
import { TZ } from "@/modules/slots";

// Recherche publique : ne renvoie jamais d'adresse ni de coordonnées privées, seulement profil public + créneaux réels.
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`search:${ip}`, 60, 60_000).ok) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  const u = new URL(req.url);
  const parts = (u.searchParams.get("services") ?? "").split(",").filter(Boolean).map((x) => x.split(":")), ids = parts.map((x) => x[0]), qtys = Object.fromEntries(parts.map(([id, q]) => [id, Math.min(6, Math.max(1, parseInt(q ?? "1", 10) || 1))])), zip = u.searchParams.get("zip") ?? "", mode = u.searchParams.get("mode") === "asap" ? "asap" : "scheduled";
  const date = u.searchParams.get("date");
  if (!isSwissZip(zip) || !ids.length || ids.length > 6) return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  const settings = await getSettings();
  const cands = await db.partner.findMany({ where: { status: "APPROVED", zones: { some: { zip } } }, select: { id: true } });
  const out = [];
  for (const c of cands) {
    const offer = await partnerOffer(c.id, zip, ids); if (!offer) continue;
    const dur = offer.items.reduce((a, i) => a + i.durationMin * (qtys[i.serviceId] ?? 1), 0);
    const totals = computeTotals(offer.items.map((i) => i.priceCents * (qtys[i.serviceId] ?? 1)), offer.zone.travelFeeCents, Number(settings.commissionBps));
    const next = (await nextSlots(c.id, dur, { days: 14, limit: 1 }))[0] ?? null;
    const asap = offer.partner.instantEnabled ? ((await nextSlots(c.id, dur, { asap: true, days: 2, limit: 1 }))[0] ?? null) : null;
    let slots: string[] = [];
    if (mode === "scheduled" && date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const from = DateTime.fromISO(date, { zone: TZ }).startOf("day").toJSDate();
      slots = (await nextSlots(c.id, dur, { from, days: 1 })).map((s) => s.toISOString());
    }
    out.push({ id: c.id, name: offer.partner.displayName, bio: offer.partner.bio, photoUrl: offer.partner.photoUrl, ratingAvg: offer.partner.ratingAvg, ratingCount: offer.partner.ratingCount,
      onlinePayment: offer.partner.onlinePaymentEnabled && paymentsReady(), durationMin: dur, subtotalCents: totals.subtotalCents, travelFeeCents: totals.travelFeeCents, totalCents: totals.totalCents, nextSlot: next?.toISOString() ?? null, asapSlot: asap?.toISOString() ?? null, slots });
  }
  const list = mode === "asap" ? out.filter((p) => p.asapSlot).sort((a, b) => a.asapSlot!.localeCompare(b.asapSlot!)) : out;
  // Aucun barbier immédiat : on propose le prochain créneau possible (jamais de disponibilité inventée).
  const fallback = mode === "asap" && !list.length ? out.filter((p) => p.nextSlot).sort((a, b) => a.nextSlot!.localeCompare(b.nextSlot!)) : [];
  return NextResponse.json({ partners: list, fallback, noPartnerInZone: cands.length === 0 });
}
