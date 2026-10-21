import Link from "next/link";
import type { ReactNode } from "react";
import { getUser, logout } from "@/lib/auth";
import { redirect } from "next/navigation";

const NAV: [string, string][] = [["/comment-ca-marche", "Comment ça marche"], ["/prestations", "Prestations"], ["/zones", "Zones"], ["/faq", "FAQ"], ["/devenir-partenaire", "Devenir barbier"]];

export async function SiteShell({ children }: { children: ReactNode }) {
  const user = await getUser();
  async function out() { "use server"; await logout(); redirect("/"); }
  const space = user ? (user.role === "PARTNER" ? "/partenaire" : user.role === "CLIENT" ? "/compte" : "/admin") : null;
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Aller au contenu</a>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/85 text-white backdrop-blur-md">
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <Link href="/" className="font-display text-2xl font-medium tracking-wide">Go<span className="italic text-gold">Barber</span><span className="text-white/50">.ch</span></Link>
          <nav aria-label="Principale" className="hidden items-center gap-6 whitespace-nowrap text-[12px] uppercase tracking-[.14em] xl:flex">
            {NAV.map(([h, l]) => <Link key={h} href={h} className="text-white/80 hover:text-white">{l}</Link>)}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (<>
              <Link href={space!} className="btn !min-h-9 border border-white/25 !px-4 text-white hover:bg-white/10 whitespace-nowrap">Mon espace</Link>
              <form action={out}><button className="text-sm text-white/70 hover:text-white">Quitter</button></form>
            </>) : <>
              <Link href="/connexion" className="text-sm text-white/80 hover:text-white">Connexion</Link>
              <Link href="/inscription" className="btn !min-h-9 whitespace-nowrap border border-gold/60 !px-4 text-gold hover:bg-gold/10"><span className="hidden sm:inline">Créer mon profil</span><span className="sm:hidden">Profil</span></Link>
            </>}
            <Link href="/reserver" className="btn-gold !min-h-9">Réserver</Link>
          </div>
        </div>
        <nav aria-label="Mobile" className="container-x flex gap-4 overflow-x-auto pb-2 text-sm xl:hidden">
          {NAV.map(([h, l]) => <Link key={h} href={h} className="whitespace-nowrap text-white/75">{l}</Link>)}
        </nav>
      </header>
      <main id="main">{children}</main>
      <footer className="mt-20 bg-ink text-white/70">
        <div className="container-x grid gap-8 py-12 text-sm sm:grid-cols-4">
          <div><p className="font-display text-lg text-white">GoBarber.ch</p><p className="mt-2">Votre barbier à domicile, en Suisse.</p></div>
          <div><p className="mb-2 font-semibold text-white">Service</p><ul className="space-y-1"><li><Link href="/reserver">Réserver</Link></li><li><Link href="/prestations">Prestations et tarifs</Link></li><li><Link href="/zones">Zones desservies</Link></li><li><Link href="/faq">FAQ</Link></li></ul></div>
          <div><p className="mb-2 font-semibold text-white">Entreprise</p><ul className="space-y-1"><li><Link href="/a-propos">À propos</Link></li><li><Link href="/devenir-partenaire">Devenir partenaire</Link></li><li><Link href="/contact">Contact et assistance</Link></li></ul></div>
          <div><p className="mb-2 font-semibold text-white">Légal</p><ul className="space-y-1">
            {[["conditions-generales", "Conditions générales"], ["confidentialite", "Confidentialité"], ["annulation", "Annulation et remboursement"], ["mentions-legales", "Mentions légales"], ["cookies", "Cookies"]].map(([s, l]) => <li key={s}><Link href={`/legal/${s}`}>{l}</Link></li>)}
          </ul></div>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs">© {new Date().getFullYear()} GoBarber.ch — Prix en CHF, TVA selon statut [À RENSEIGNER]</p>
      </footer>
    </>
  );
}
