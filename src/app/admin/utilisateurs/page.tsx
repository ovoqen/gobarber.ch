import { db } from "@/lib/db";
import { requireStaff, PASSWORD_HINT } from "@/lib/auth";
import { Alert, Field } from "@/components/ui";
import { ConfirmForm } from "@/components/Confirm";
import { setUserActive, createStaff, setStaffCalendar } from "../actions";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string; q?: string }> }) {
  await requireStaff("users.manage"); const sp = await searchParams;
  const list = await db.user.findMany({ where: sp.q ? { email: { contains: sp.q.toLowerCase() } } : {}, orderBy: { createdAt: "desc" }, take: 100, select: { canEditCalendar: true, id: true, email: true, role: true, active: true, deletedAt: true, totpEnabled: true, createdAt: true, firstName: true, lastName: true } });
  return <div className="space-y-4"><h1 className="text-3xl font-semibold">Utilisateurs et accès</h1>{sp.ok && <Alert kind="ok">{sp.ok}</Alert>}{sp.e && <Alert kind="error">{sp.e}</Alert>}
    <form className="flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Rechercher un e-mail" className="field max-w-xs" /><button className="btn-ghost">Chercher</button></form>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-muted"><th className="py-2">E-mail</th><th>Rôle</th><th>2FA</th><th>État</th><th>Modifier le calendrier</th><th /></tr></thead><tbody>{list.map((u) => <tr key={u.id} className="border-b border-line"><td className="py-2">{u.email}</td><td>{u.role}</td><td>{["ADMIN", "SUPPORT"].includes(u.role) ? (u.totpEnabled ? "oui" : "à activer") : "—"}</td><td>{u.deletedAt ? "supprimé" : u.active ? "actif" : "désactivé"}</td>
      <td>{u.role === "ADMIN" ? "toujours" : u.role === "SUPPORT" ? <form action={setStaffCalendar} className="flex items-center gap-2"><input type="hidden" name="id" value={u.id} /><input type="hidden" name="on" value={u.canEditCalendar ? "0" : "1"} /><span>{u.canEditCalendar ? "autorisé" : "lecture seule"}</span><button className="btn-ghost !min-h-8 !px-3">{u.canEditCalendar ? "Retirer" : "Autoriser"}</button></form> : "—"}</td>
      <td>{!u.deletedAt && <ConfirmForm action={setUserActive} message={u.active ? "Désactiver ce compte ?" : "Réactiver ce compte ?"} className="flex gap-1"><input type="hidden" name="id" value={u.id} /><input name="reason" required minLength={5} placeholder="Motif" className="field !min-h-8 !py-1" /><button className="btn-ghost !min-h-8">{u.active ? "Désactiver" : "Réactiver"}</button></ConfirmForm>}</td></tr>)}</tbody></table></div>
    <h2 className="pt-4 text-xl font-semibold">Créer un compte du personnel</h2>
    <ConfirmForm action={createStaff} message="Créer ce compte du personnel ?" className="card grid gap-3 sm:grid-cols-3"><Field label="Prénom" name="firstName" required /><Field label="Nom" name="lastName" required /><Field label="E-mail" name="email" type="email" required />
      <div><label className="lbl" htmlFor="role">Rôle</label><select id="role" name="role" className="field"><option value="SUPPORT">Support (lecture et assistance)</option><option value="ADMIN">Administrateur (tous droits)</option></select></div><Field label="Mot de passe initial" name="password" type="password" required hint={PASSWORD_HINT} /><button className="btn-dark self-end">Créer</button></ConfirmForm></div>;
}
