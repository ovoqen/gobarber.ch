import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Funnel } from "./Funnel";
export const metadata = { title: "Réserver un barbier" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ zip?: string; q?: string; service?: string; when?: string }> }) {
  const [services, user, s] = await Promise.all([db.service.findMany({ where: { active: true }, orderBy: { sort: "asc" } }), getUser(), getSettings()]);
  const sp = await searchParams;
  const addresses = user?.role === "CLIENT" ? await db.address.findMany({ where: { userId: user.id } }) : [];
  return <div className="container-x max-w-3xl py-10"><Funnel services={services.map((x) => ({ code: x.code, id: x.id, name: x.name, description: x.description, priceCents: x.priceCents, durationMin: x.durationMin }))}
    initialServiceId={services.find((x) => x.code === sp.service)?.id ?? ""} initialWhen={sp.when ?? ""} initialQuery={(sp.q ?? sp.zip ?? "").slice(0, 80)} loggedIn={user?.role === "CLIENT"} addresses={addresses.map((a) => ({ id: a.id, label: a.label, street: a.street, zip: a.zip, city: a.city, access: a.access }))}
    policy={`Annulation gratuite jusqu'à ${s.freeBeforeHours} h avant ; ${s.lateFeePercent} % retenus entre ${s.freeBeforeHours} h et ${s.lateWindowHours} h ; montant dû en dessous.`} /></div>;
}
