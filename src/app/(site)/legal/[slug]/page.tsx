import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Markdown } from "@/components/Markdown";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const p = await db.contentPage.findUnique({ where: { slug: (await params).slug } }); return { title: p?.title ?? "Document" }; }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const page = await db.contentPage.findUnique({ where: { slug: (await params).slug } });
  if (!page || !page.published) notFound();
  return <article className="container-x max-w-3xl py-12"><h1 className="mb-6 text-3xl font-semibold sm:text-4xl">{page.title}</h1><Markdown text={page.body} /><p className="mt-8 text-xs text-muted">Dernière mise à jour : {page.updatedAt.toLocaleDateString("fr-CH")}</p></article>;
}
