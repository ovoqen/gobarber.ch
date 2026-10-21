import { redirect } from "next/navigation";
import { login, getUser } from "@/lib/auth";
import { Field, Alert } from "@/components/ui";
async function act(fd: FormData) {
  "use server";
  const r = await login(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""), String(fd.get("totp") ?? "") || undefined);
  if (!r.ok) redirect(`/admin/login?e=${encodeURIComponent(r.error)}${"needTotp" in r && r.needTotp ? "&t=1" : ""}`);
  if (r.role !== "ADMIN" && r.role !== "SUPPORT") redirect("/");
  redirect(r.mfa ? "/admin" : "/admin/2fa");
}
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; t?: string; info?: string }> }) {
  const sp = await searchParams; const cur = await getUser(); if (cur?.mfa && ["ADMIN", "SUPPORT"].includes(cur.role)) redirect("/admin");
  return (
    <div className="mx-auto max-w-sm"><h1 className="mb-4 text-2xl font-semibold">Connexion administrateur</h1>
      {sp.e && <div className="mb-3"><Alert kind="error">{sp.e}</Alert></div>}{sp.info && <div className="mb-3"><Alert>Connectez-vous ici (mot de passe + code 2FA) pour accéder à l'administration.</Alert></div>}
      <form action={act} className="card space-y-4"><Field label="E-mail" name="email" type="email" required autoComplete="username" /><Field label="Mot de passe" name="password" type="password" required autoComplete="current-password" />
        <Field label="Code à 6 chiffres (application d'authentification)" name="totp" autoComplete="one-time-code" placeholder="Laisser vide à la 1re connexion" /><button className="btn-dark w-full">Connexion</button></form></div>
  );
}
