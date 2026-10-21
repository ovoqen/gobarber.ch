import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getUser, logout } from "@/lib/auth";
import { can } from "@/lib/rbac";
export const metadata = { title: "Administration", robots: { index: false, follow: false } };
const NAV: [string, string, string][] = [["/admin", "Tableau de bord", "admin.view"], ["/admin/calendrier", "Calendrier", "bookings.manage"], ["/admin/annulations", "Annulations", "bookings.manage"], ["/admin/partenaires", "Partenaires", "partners.manage"], ["/admin/reservations", "Réservations", "bookings.manage"], ["/admin/paiements", "Paiements", "payments.manage"], ["/admin/catalogue", "Catalogue", "catalog.manage"], ["/admin/promos", "Promos", "promos.manage"], ["/admin/avis", "Avis", "reviews.moderate"], ["/admin/signalements", "Signalements", "reviews.moderate"], ["/admin/contenus", "Contenus", "content.manage"], ["/admin/utilisateurs", "Utilisateurs", "users.manage"], ["/admin/parametres", "Paramètres", "settings.manage"], ["/admin/audit", "Journal", "audit.view"], ["/admin/securite", "Sécurité", "audit.view"], ["/admin/outbox", "E-mails", "settings.manage"]];
export default async function Layout({ children }: { children: ReactNode }) {
  const u = await getUser();
  async function out() { "use server"; await logout(); redirect("/admin/login"); }
  return (
    <div className="dash" style={{ minHeight: "100vh" }}>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/90 text-white backdrop-blur-md"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3"><Link href="/admin" className="font-display text-2xl font-medium">Go<span className="italic text-gold">Barber</span> <span className="text-sm uppercase tracking-[.3em] text-white/45">Admin</span></Link>
        {u && <div className="flex items-center gap-3 text-sm"><span className="hidden text-white/55 sm:inline">{u.email} · {u.role}</span><form action={out}><button className="rounded-full border border-white/20 px-4 py-1.5 text-white/80 hover:bg-white/10">Quitter</button></form></div>}</div>
        {u?.mfa && <nav aria-label="Administration" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 text-[13px]">{NAV.filter(([, , p]) => can(u.role, p as never)).map(([h, l]) => <Link key={h} href={h} className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-white/65 transition hover:bg-white/10 hover:text-white">{l}</Link>)}</nav>}</header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
