import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { Alert } from "@/components/ui";
import { savePage } from "../actions";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; slug?: string }> }) {
  await requireStaff("content.manage"); const sp = await searchParams; const pages = await db.contentPage.findMany({ orderBy: { slug: "asc" } });
  const cur = pages.find((p) => p.slug === sp.slug) ?? pages[0];
  return <div className="space-y-4"><h1 className="text-3xl font-semibold">Contenus et documents juridiques</h1>{sp.ok && <Alert kind="ok">{sp.ok}</Alert>}
    <Alert>Les documents juridiques sont des <strong>projets</strong> : faites-les valider par un professionnel et complétez tous les champs [À RENSEIGNER] avant le lancement.</Alert>
    <div className="flex flex-wrap gap-2">{pages.map((p) => <a key={p.slug} href={`/admin/contenus?slug=${p.slug}`} className={`rounded-full border px-3 py-1 text-sm ${p.slug === cur?.slug ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>{p.slug}</a>)}</div>
    {cur && <form action={savePage} className="card space-y-3"><input type="hidden" name="slug" value={cur.slug} /><label className="lbl" htmlFor="title">Titre</label><input id="title" name="title" defaultValue={cur.title} className="field" /><label className="lbl" htmlFor="body">Contenu (Markdown simplifié : ## titre, - liste, **gras**)</label><textarea id="body" name="body" rows={22} defaultValue={cur.body} className="field font-mono text-sm" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={cur.published} className="size-5" />Publié</label><button className="btn-dark">Enregistrer</button></form>}</div>;
}
