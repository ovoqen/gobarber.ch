import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Markdown } from "@/components/Markdown";
import { Field, Alert, PageTitle } from "@/components/ui";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth";
import { sendMail } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { z } from "zod";
export const metadata = { title: "Contact et assistance" };
export const dynamic = "force-dynamic";

async function send(fd: FormData) {
  "use server";
  if (!rateLimit(`contact:${await clientIp()}`, 5, 3600_000).ok) redirect("/contact?e=rate");
  const p = z.object({ name: z.string().min(2).max(100), email: z.string().email().max(200), ref: z.string().max(30).optional(), msg: z.string().min(10).max(4000), hp: z.string().max(0).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/contact?e=invalid");
  const s = await getSettings();
  await sendMail(s.supportEmail.startsWith("[") ? "support@gobarber.invalid" : s.supportEmail, `Assistance — ${p.data.name}${p.data.ref ? ` (${p.data.ref})` : ""}`, `De : ${p.data.name} <${p.data.email}>\n\n${p.data.msg}`);
  redirect("/contact?ok=1");
}
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const sp = await searchParams, page = await db.contentPage.findUnique({ where: { slug: "contact" } });
  return (
    <div className="container-x max-w-2xl py-12">
      <PageTitle title="Contact et assistance" />{page && <Markdown text={page.body} />}
      <div className="mt-6 space-y-4">
        {sp.ok && <Alert kind="ok">Message envoyé. Nous vous répondons par e-mail.</Alert>}
        {sp.e && <Alert kind="error">{sp.e === "rate" ? "Trop de messages. Réessayez plus tard." : "Vérifiez les champs du formulaire."}</Alert>}
        <form action={send} className="card space-y-4">
          <Field label="Nom" name="name" required autoComplete="name" /><Field label="E-mail" name="email" type="email" required autoComplete="email" />
          <Field label="N° de réservation (facultatif)" name="ref" placeholder="GB-2026-123456" />
          <div><label htmlFor="msg" className="lbl">Message *</label><textarea id="msg" name="msg" required minLength={10} rows={5} className="field" /></div>
          <input name="hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <button className="btn-dark">Envoyer</button>
        </form>
      </div>
    </div>
  );
}
