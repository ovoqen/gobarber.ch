import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePartner } from "@/lib/auth";
import { Alert, PageTitle } from "@/components/ui";
import { ManualBookingForm } from "@/components/ManualBookingForm";
import { PNav } from "../PartnerNav";
import { partnerCreateManual } from "../actions";
export const metadata = { title: "Nouveau rendez-vous" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const u = await requirePartner();
  const p = await db.partner.findUniqueOrThrow({ where: { id: u.partner.id }, include: { services: { where: { active: true }, include: { service: true } } } });
  if (!p.canManageCalendar) redirect("/partenaire?e=" + encodeURIComponent("L'administrateur ne vous a pas encore autorisé à gérer votre calendrier."));
  return (
    <div className="container-x max-w-2xl py-10"><PageTitle title="Nouveau rendez-vous" /><PNav current="/partenaire" />
      {(await searchParams).e && <div className="mb-4"><Alert kind="error">{(await searchParams).e}</Alert></div>}
      <ManualBookingForm askClientEmail={false} action={partnerCreateManual} cancelHref="/partenaire" partner={{ id: p.id, name: p.displayName, services: p.services.map((s) => ({ id: s.serviceId, name: s.service.name, priceCents: s.priceCents, durationMin: s.durationMin })) }} /></div>
  );
}
