import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { TZ } from "@/modules/slots";
import { Alert } from "@/components/ui";
import { ConfirmForm } from "@/components/Confirm";
export const metadata = { title: "Signalements" };
export const dynamic = "force-dynamic";
async function act(fd: FormData) {
  "use server";
  const u = await requireStaff("reviews.moderate"); const id = String(fd.get("id")), what = String(fd.get("what"));
  if (what === "delete") { await db.message.delete({ where: { id } }); await audit(u.id, "message.delete", "Message", id); }
  else if (what === "dismiss") { await db.message.update({ where: { id }, data: { flagged: false } }); await audit(u.id, "message.dismiss_report", "Message", id); }
  redirect("/admin/signalements?ok=1");
}
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireStaff("reviews.moderate");
  const msgs = await db.message.findMany({ where: { flagged: true }, include: { sender: { select: { id: true, email: true, role: true } }, booking: { select: { number: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  const reviews = await db.review.findMany({ where: { status: "REPORTED" }, include: { booking: { select: { number: true, partner: { select: { displayName: true } } } } }, take: 50 });
  return (
    <div className="space-y-5"><div><p className="eyebrow mb-2">Modération</p><h1 className="text-4xl">Signalements</h1></div>
      {(await searchParams).ok && <Alert kind="ok">Traité.</Alert>}
      <section className="card"><h2 className="mb-3 text-2xl">Messages signalés ({msgs.length})</h2><ul className="space-y-3 text-sm">{msgs.map((m) => <li key={m.id} className="rounded-xl border border-line p-3"><p className="text-muted">{m.booking.number} · {m.sender.role} {m.sender.email} · {m.createdAt.toLocaleString("fr-CH", { timeZone: TZ })}</p><p className="my-2">{m.body}</p>
        <div className="flex gap-2"><ConfirmForm action={act} message="Supprimer ce message ?"><input type="hidden" name="id" value={m.id} /><input type="hidden" name="what" value="delete" /><button className="btn-danger !min-h-9">Supprimer le message</button></ConfirmForm><form action={act}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="what" value="dismiss" /><button className="btn-ghost !min-h-9">Ignorer le signalement</button></form></div>
        <p className="mt-2 text-xs text-muted">Pour sanctionner l'auteur : Utilisateurs (désactiver) ou Partenaires (suspendre).</p></li>)}{!msgs.length && <li className="text-muted">Aucun message signalé.</li>}</ul></section>
      <section className="card"><h2 className="mb-3 text-2xl">Avis signalés ({reviews.length})</h2><ul className="space-y-2 text-sm">{reviews.map((r) => <li key={r.id}>{r.booking.partner.displayName} · {r.booking.number} · {"★".repeat(r.rating)} {r.comment} — <a href="/admin/avis" className="underline">modérer</a></li>)}{!reviews.length && <li className="text-muted">Aucun avis signalé.</li>}</ul></section></div>
  );
}
