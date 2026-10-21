import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Markdown } from "@/components/Markdown";
const SLUGS = ["comment-ca-marche", "a-propos", "faq", "devenir-partenaire"];
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ page: string }> }) { const p = await db.contentPage.findUnique({ where: { slug: (await params).page } }); return { title: p?.title }; }
export default async function Page({ params }: { params: Promise<{ page: string }> }) {
  const slug = (await params).page;
  if (!SLUGS.includes(slug)) notFound();
  const page = await db.contentPage.findUnique({ where: { slug } });
  if (!page) notFound();
  return (
    <article className="container-x max-w-3xl py-12">
      <h1 className="mb-6 text-3xl font-semibold sm:text-4xl">{page.title}</h1><Markdown text={page.body} />
      {slug === "devenir-partenaire" && <div className="mt-8 flex gap-3"><Link href="/partenaire/inscription" className="btn-gold">Déposer ma candidature</Link><Link href="/legal/contrat-partenaire" className="btn-ghost">Lire le contrat partenaire</Link></div>}
      {slug === "comment-ca-marche" && <Link href="/reserver" className="btn-gold mt-8">Réserver un barbier</Link>}
    </article>
  );
}
