import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/lib/auth";
import { Field, Alert, PageTitle } from "@/components/ui";
export const metadata = { title: "Connexion" };

const safeNext = (n?: string | null) => (n && /^\/(?!\/)/.test(n) ? n : null);
async function act(fd: FormData) {
  "use server";
  const next = safeNext(String(fd.get("next") ?? ""));
  const r = await login(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""), undefined, fd.get("remember") === "on");
  if (!r.ok) redirect(`/connexion?e=${encodeURIComponent(r.error)}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  if (r.role === "ADMIN" || r.role === "SUPPORT") redirect("/admin/login?info=staff");
  redirect(next ?? (r.role === "PARTNER" ? "/partenaire" : "/compte"));
}
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; next?: string; ok?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="container-x max-w-md py-12">
      <PageTitle title="Connexion" />
      {sp.ok && <div className="mb-4"><Alert kind="ok">{sp.ok}</Alert></div>}{sp.e && <div className="mb-4"><Alert kind="error">{sp.e}</Alert></div>}
      <form action={act} className="card space-y-4">
        <input type="hidden" name="next" value={safeNext(sp.next) ?? ""} />
        <Field label="E-mail" name="email" type="email" required autoComplete="email" />
        <Field label="Mot de passe" name="password" type="password" required autoComplete="current-password" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="remember" defaultChecked className="size-5" />Rester connecté sur cet appareil</label>
        <button className="btn-dark w-full">Se connecter</button>
        <p className="flex justify-between text-sm"><Link href="/mot-de-passe-oublie" className="underline">Mot de passe oublié ?</Link><Link href="/inscription" className="underline">Créer mon profil</Link></p>
      </form>
    </div>
  );
}
