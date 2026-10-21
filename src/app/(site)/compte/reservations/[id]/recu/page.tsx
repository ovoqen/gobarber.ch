import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { fmtDateTime } from "@/modules/slots";
import { chf } from "@/modules/pricing";
export const metadata = { title: "Reçu" };
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireClient();
  const b = await db.booking.findFirst({ where: { id: (await params).id, clientId: u.id, status: { in: ["COMPLETED", "NO_SHOW_CLIENT"] } }, include: { items: true, partner: true } });
  if (!b) notFound();
  const s = await getSettings();
  return (
    <div className="container-x max-w-2xl py-10">
      <div className="card space-y-4 print:border-0 print:shadow-none">
        <div className="flex justify-between"><h1 className="text-2xl font-semibold">Reçu {b.number}</h1><button className="btn-ghost print:hidden" onClick={undefined} form="print">Imprimer : Ctrl/Cmd + P</button></div>
        <p className="text-sm">Émis par {s.companyName} pour le compte de {b.partner.displayName} (barbier indépendant). TVA : [À RENSEIGNER].</p>
        <p className="text-sm">Client : {u.firstName} {u.lastName} · Date : {fmtDateTime(b.startsAt)}</p>
        <ul className="border-t border-line pt-3 text-sm">{b.items.map((i) => <li key={i.id} className="flex justify-between"><span>{i.quantity > 1 ? `${i.quantity} × ` : ""}{i.name}</span><span>{chf(i.priceCents * i.quantity)}</span></li>)}
          {b.discountCents > 0 && <li className="flex justify-between"><span>Remise {b.promoCode}</span><span>− {chf(b.discountCents)}</span></li>}
          <li className="flex justify-between"><span>Frais de déplacement</span><span>{chf(b.travelFeeCents)}</span></li><li className="flex justify-between border-t border-line pt-2 font-semibold"><span>Total payé</span><span>{chf(b.totalCents)}</span></li></ul>
      </div>
    </div>
  );
}
