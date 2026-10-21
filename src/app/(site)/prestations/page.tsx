import Link from "next/link";
import { db } from "@/lib/db";
import { chf } from "@/modules/pricing";
import { PageTitle } from "@/components/ui";
export const metadata = { title: "Prestations et tarifs" };
export const dynamic = "force-dynamic";
export default async function Page() {
  const services = await db.service.findMany({ where: { active: true }, orderBy: { sort: "asc" }, include: { partnerServices: { where: { active: true, partner: { status: "APPROVED" } } } } });
  return (
    <div className="container-x py-12">
      <PageTitle title="Prestations et tarifs" sub="Chaque barbier fixe ses prix : le montant exact, les frais de déplacement de votre zone et les conditions d'annulation sont affichés avant le paiement." />
      <div className="grid gap-4 sm:grid-cols-2">
        {services.map((s) => {
          const prices = s.partnerServices.map((p) => p.priceCents);
          return (
            <div key={s.id} className="card">
              <h2 className="text-xl font-semibold">{s.name}</h2><p className="text-sm text-muted">{s.description}</p>
              <p className="mt-3 text-sm">Durée indicative : {s.durationMin} min</p>
              <p className="mt-1 font-semibold">{prices.length ? `De ${chf(Math.min(...prices))} à ${chf(Math.max(...prices))}` : `Prix indicatif : dès ${chf(s.priceCents)}`}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-muted">+ frais de déplacement selon la zone (affichés à l'étape « barbier »). <Link href="/legal/annulation" className="underline">Politique d'annulation</Link>.</p>
    </div>
  );
}
