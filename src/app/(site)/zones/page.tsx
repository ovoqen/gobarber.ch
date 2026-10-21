import Link from "next/link";
import { db } from "@/lib/db";
import { PageTitle } from "@/components/ui";
export const metadata = { title: "Zones desservies" };
export const dynamic = "force-dynamic";
export default async function Page() {
  const zones = await db.partnerZone.findMany({ where: { partner: { status: "APPROVED" } }, select: { zip: true, city: true }, distinct: ["zip"], orderBy: { zip: "asc" } });
  const byCity = new Map<string, string[]>(); for (const z of zones) byCity.set(z.city, [...(byCity.get(z.city) ?? []), z.zip]);
  return (
    <div className="container-x py-12">
      <PageTitle title="Zones desservies" sub="La liste ci-dessous reflète uniquement les zones où au moins un barbier vérifié intervient réellement." />
      {byCity.size === 0 ? <p className="card">Aucune zone ouverte pour l'instant. <Link href="/devenir-partenaire" className="underline">Barbier ? Ouvrez la vôtre.</Link></p> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...byCity].map(([c, z]) => <li key={c} className="card"><p className="font-semibold">{c}</p><p className="text-sm text-muted">{z.join(" · ")}</p></li>)}</ul>
      )}
    </div>
  );
}
