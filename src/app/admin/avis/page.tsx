import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { Alert } from "@/components/ui";
import { moderateReview } from "../actions";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireStaff("reviews.moderate"); const list = await db.review.findMany({ include: { booking: { select: { number: true, partner: { select: { displayName: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <div className="space-y-3"><h1 className="text-3xl font-semibold">Modération des avis</h1>{(await searchParams).ok && <Alert kind="ok">Mis à jour.</Alert>}
    {list.map((r) => <article key={r.id} className="card flex flex-wrap items-start justify-between gap-3 text-sm"><div><p className="font-semibold">{r.booking.partner.displayName} · {r.booking.number} · {"★".repeat(r.rating)}</p><p>{r.comment || <em className="text-muted">Sans commentaire</em>}</p><p className="text-xs text-muted">{r.status}</p></div>
      <form action={moderateReview.bind(null, r.id, r.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED")}>{r.status === "PUBLISHED" ? <button className="btn-danger">Masquer</button> : <button className="btn-ghost">Rétablir</button>}</form></article>)}{!list.length && <p className="text-muted">Aucun avis.</p>}</div>;
}
