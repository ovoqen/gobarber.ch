import Link from "next/link";
import { db } from "@/lib/db";
import { chf } from "@/modules/pricing";
import communes from "@/data/ge-communes.json";
import HomeHero from "@/components/HomeHero";

export const dynamic = "force-dynamic";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+ge$/, "").replace(/œ/g, "oe").trim();

export default async function Home() {
  const [services, zones] = await Promise.all([
    db.service.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    db.partnerZone.findMany({ where: { partner: { status: "APPROVED" } }, select: { city: true, partnerId: true } }),
  ]);
  // Barbiers réellement actifs par commune (rien d'inventé : 0 = « Bientôt disponible »).
  const counts: Record<string, number> = {};
  for (const c of communes) { const n = norm(c.name); counts[c.name] = new Set(zones.filter((z) => { const k = norm(z.city); return k === n || k.includes(n) || n.includes(k); }).map((z) => z.partnerId)).size; }
  return (
    <>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_55%,rgba(184,145,58,.16),transparent_70%)]" />
        <div className="container-x relative py-12 sm:py-20"><HomeHero counts={counts} /></div>
      </section>

      <section className="bg-coal text-white">
        <div className="container-x py-20">
          <div className="mb-10 flex items-end justify-between gap-4"><div><p className="eyebrow mb-3">Prestations</p><h2 className="text-4xl sm:text-5xl">Le geste juste.</h2></div><Link href="/prestations" className="hidden text-[13px] uppercase tracking-[.14em] text-gold sm:block">Tous les tarifs →</Link></div>
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {services.map((s, i) => (
              <li key={s.id} className="grid grid-cols-[3rem_1fr_auto] items-baseline gap-4 py-6 transition hover:bg-white/[.03] sm:grid-cols-[4rem_1fr_auto_auto] sm:px-3">
                <span className="font-display text-2xl italic text-gold/70">{String(i + 1).padStart(2, "0")}</span>
                <div><p className="font-display text-2xl sm:text-3xl">{s.name}</p><p className="text-sm text-white/50">{s.description}</p></div>
                <span className="hidden text-sm text-white/50 sm:block">{s.durationMin} min</span><span className="font-display text-xl text-gold">dès {chf(s.priceCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-x py-24">
        <p className="eyebrow mb-3">Le rituel</p><h2 className="max-w-xl text-4xl sm:text-5xl">Simple, transparent, sans surprise.</h2>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {[["I", "Réservez", "Votre commune, la prestation, le barbier, le créneau. « Dès que possible » seulement si un barbier est réellement disponible."], ["II", "Payez en ligne", "Carte, Apple Pay, Google Pay ou TWINT selon disponibilité. Débité uniquement après acceptation du barbier."], ["III", "Profitez", "Suivi en temps réel, messagerie sécurisée, reçu et avis après la prestation."]].map(([n, t, d]) => (
            <div key={n} className="border-t border-gold/50 pt-6"><p className="font-display text-5xl italic text-gold">{n}</p><h3 className="mt-4 text-2xl">{t}</h3><p className="mt-2 leading-relaxed text-muted">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="bg-ink text-white"><div className="container-x flex flex-col items-start justify-between gap-6 py-16 sm:flex-row sm:items-center">
        <h2 className="text-3xl sm:text-4xl">Barbier ? <span className="italic text-gold">Rejoignez-nous.</span></h2>
        <div className="flex flex-wrap gap-3"><Link href="/reserver" className="btn-gold">Réserver un barbier</Link><Link href="/devenir-partenaire" className="btn border border-white/30 text-white hover:bg-white/10">Devenir partenaire</Link></div></div></section>
    </>
  );
}
