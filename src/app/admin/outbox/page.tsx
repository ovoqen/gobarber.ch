import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
// Consultation des e-mails sortants (utile tant que le SMTP n'est pas configuré). En production, restreindre ou retirer.
export default async function Page() {
  await requireStaff("settings.manage");
  if (process.env.NODE_ENV === "production") notFound(); // contient des liens de vérification : jamais consultable en production
  const rows = await db.outbox.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return <div className="space-y-3"><h1 className="text-3xl font-semibold">E-mails sortants</h1><p className="text-sm text-muted">{process.env.SMTP_HOST ? "SMTP configuré." : "SMTP non configuré : les e-mails ne sont pas envoyés, ils sont listés ici (liens de vérification inclus)."}</p>
    {rows.map((r) => <article key={r.id} className="card text-sm"><p className="font-semibold">{r.subject} <span className="font-normal text-muted">→ {r.toEmail} · {r.sentAt ? "envoyé" : r.error ? `erreur : ${r.error}` : "non envoyé"}</span></p><pre className="mt-2 whitespace-pre-wrap break-words text-xs">{r.body}</pre></article>)}</div>;
}
