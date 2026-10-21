import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { Alert } from "@/components/ui";
import { ConfirmForm } from "@/components/Confirm";
import { setPartnerStatus, setPartnerCalendar, setPartnerOnlinePayment } from "../actions";
export const dynamic = "force-dynamic";
const L: Record<string, string> = { DRAFT: "Brouillon", PENDING: "À vérifier", APPROVED: "Actif", SUSPENDED: "Suspendu", REJECTED: "Refusé" };
const DK: Record<string, string> = { ID: "Identité", PERMIT: "Autorisation", BUSINESS_PROOF: "Activité", INSURANCE: "Assurance RC", OTHER: "Autre" };
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  await requireStaff("partners.manage"); const sp = await searchParams;
  const list = await db.partner.findMany({ include: { user: { select: { email: true, phone: true, emailVerifiedAt: true } }, documents: true, zones: true, services: true }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  const order = ["PENDING", "APPROVED", "SUSPENDED", "DRAFT", "REJECTED"]; list.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return (
    <div className="space-y-4"><h1 className="text-3xl font-semibold">Partenaires</h1>{sp.ok && <Alert kind="ok">{sp.ok}</Alert>}{sp.e && <Alert kind="error">{sp.e}</Alert>}
      {list.map((p) => (
        <article key={p.id} className="card space-y-2 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{p.displayName} <span className="text-sm font-normal text-muted">{p.user.email} · {p.user.phone}</span></h2><span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold">{L[p.status]}</span></div>
          <p>Statut : {p.legalForm ?? "—"} · IDE {p.ideNumber ?? "—"} · TVA {p.vatNumber ?? "—"} · e-mail {p.user.emailVerifiedAt ? "confirmé" : "non confirmé"} · contrat {p.contractAcceptedAt ? `accepté (${p.contractVersion})` : "non accepté"} · {p.services.length} prestation(s) · {p.zones.length} zone(s)</p>
          <p>Documents : {p.documents.length ? p.documents.map((d) => <a key={d.id} href={`/api/admin/documents/${d.id}`} target="_blank" className="mr-2 underline">{DK[d.kind]}</a>) : "aucun"}</p>
          {p.status === "APPROVED" && <form action={setPartnerOnlinePayment} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="on" value={p.onlinePaymentEnabled ? "0" : "1"} /><span>Paiement : <strong>{p.onlinePaymentEnabled ? "en ligne (carte, Apple Pay, Google Pay, TWINT)" : "sur place, au barbier"}</strong> · compte Stripe : {p.stripeStatus === "complete" ? "relié ✓" : p.stripeStatus === "pending" ? "incomplet" : "non relié"}</span><button className="btn-ghost !min-h-9">{p.onlinePaymentEnabled ? "Passer en paiement sur place" : "Activer le paiement en ligne"}</button></form>}
          {p.status === "APPROVED" && <form action={setPartnerCalendar} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="on" value={p.canManageCalendar ? "0" : "1"} /><span>Calendrier : <strong>{p.canManageCalendar ? "le barbier peut ajouter et déplacer ses rendez-vous" : "lecture seule pour le barbier"}</strong></span><button className="btn-ghost !min-h-9">{p.canManageCalendar ? "Retirer ce droit" : "Autoriser"}</button></form>}
          <ConfirmForm action={setPartnerStatus} message="Confirmer ce changement de statut ? Il sera enregistré dans le journal." className="flex flex-wrap items-center gap-2 border-t border-line pt-2"><input type="hidden" name="id" value={p.id} /><input name="reason" required minLength={5} placeholder="Motif (obligatoire, visible du partenaire)" className="field max-w-xs" />
            <label className="sr-only" htmlFor={`to${p.id}`}>Nouveau statut</label><select id={`to${p.id}`} name="to" defaultValue={p.status === "APPROVED" ? "SUSPENDED" : "APPROVED"} className="field !w-auto"><option value="APPROVED">Approuver / réactiver</option><option value="REJECTED">Refuser</option><option value="SUSPENDED">Suspendre</option></select><button className="btn-dark">Appliquer</button></ConfirmForm></article>))}
      {!list.length && <p className="text-muted">Aucun partenaire.</p>}</div>
  );
}
