import { db } from "@/lib/db";
import { requireStaff, revokeAllSessions } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { logSecurity } from "@/lib/security";
import { redirect } from "next/navigation";
import { TZ } from "@/modules/slots";
import { Kpi } from "@/components/dash";
import { Alert } from "@/components/ui";
import { ConfirmForm } from "@/components/Confirm";
export const metadata = { title: "Sécurité" };
export const dynamic = "force-dynamic";

async function revokeUser(fd: FormData) {
  "use server";
  const u = await requireStaff("users.manage"); const id = String(fd.get("id"));
  const n = await revokeAllSessions(id); await audit(u.id, "sessions.revoke_all", "User", id, { count: n.count }); await logSecurity("SESSIONS_REVOKED", "WARN", { userId: u.id, detail: `cible ${id}` });
  redirect("/admin/securite?ok=" + encodeURIComponent(`${n.count} session(s) coupée(s).`));
}
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireStaff("audit.view");
  const day = new Date(Date.now() - 86_400_000);
  const [events, high24, failed24, active, staffSessions] = await Promise.all([
    db.securityEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.securityEvent.count({ where: { severity: "HIGH", createdAt: { gt: day } } }), db.securityEvent.count({ where: { type: "LOGIN_FAILED", createdAt: { gt: day } } }),
    db.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    db.session.findMany({ where: { revokedAt: null, expiresAt: { gt: new Date() }, user: { role: { in: ["ADMIN", "SUPPORT"] } } }, include: { user: { select: { id: true, email: true, role: true } } }, orderBy: { lastSeenAt: "desc" }, take: 30 }),
  ]);
  const color = (s: string) => (s === "HIGH" ? "bg-bad/20 text-bad" : s === "WARN" ? "bg-gold-100 text-gold-600" : "bg-white/10");
  return (
    <div className="space-y-6"><div><p className="eyebrow mb-2">Protection</p><h1 className="text-4xl">Sécurité</h1></div>
      {(await searchParams).ok && <Alert kind="ok">{(await searchParams).ok}</Alert>}
      {high24 > 0 && <Alert kind="error">{high24} alerte(s) grave(s) dans les dernières 24 h : lisez la liste ci-dessous.</Alert>}
      <div className="grid gap-3 sm:grid-cols-3"><Kpi label="Alertes graves (24 h)" value={String(high24)} accent={high24 > 0} /><Kpi label="Échecs de connexion (24 h)" value={String(failed24)} /><Kpi label="Sessions actives" value={String(active)} /></div>
      <section className="card"><h2 className="mb-3 text-2xl">Sessions du personnel</h2>
        <ul className="divide-y divide-white/10 text-sm">{staffSessions.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{s.user.email} · {s.user.role} · dernière activité {s.lastSeenAt.toLocaleString("fr-CH", { timeZone: TZ })} · {s.ip ?? "IP ?"}</span>
          <ConfirmForm action={revokeUser} message="Couper toutes les sessions de cet utilisateur ?"><input type="hidden" name="id" value={s.user.id} /><button className="btn-danger !min-h-8">Déconnecter partout</button></ConfirmForm></li>)}{!staffSessions.length && <li className="py-2 text-muted">Aucune.</li>}</ul></section>
      <section className="card"><h2 className="mb-3 text-2xl">Événements</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Date</th><th>Niveau</th><th>Événement</th><th>IP</th><th>Détail</th></tr></thead>
        <tbody>{events.map((e) => <tr key={e.id} className="border-b border-line"><td className="whitespace-nowrap py-2">{e.createdAt.toLocaleString("fr-CH", { timeZone: TZ })}</td><td><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${color(e.severity)}`}>{e.severity}</span></td><td>{e.type}{e.alerted && " 🔔"}</td><td>{e.ip ?? "—"}</td><td className="max-w-xs break-words text-muted">{e.detail}</td></tr>)}</tbody></table>{!events.length && <p className="py-4 text-muted">Aucun événement.</p>}</div></section>
      <p className="text-sm text-muted">Alertes graves : e-mail aux administrateurs{process.env.ALERT_WEBHOOK_URL ? " + webhook (Slack/Discord) configuré" : " (ajoutez ALERT_WEBHOOK_URL pour Slack/Discord)"}.</p></div>
  );
}
