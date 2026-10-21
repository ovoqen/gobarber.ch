import { db } from "@/lib/db";
import { revokeAllSessions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TZ } from "@/modules/slots";

/** Liste des appareils connectés (partagée par l'espace client et l'espace barbier). */
export async function DevicesPanel({ userId, currentSid, back }: { userId: string; currentSid?: string; back: string }) {
  const list = await db.session.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, take: 10 });
  async function logoutOthers() { "use server"; await revokeAllSessions(userId, currentSid); redirect(back + "?ok=" + encodeURIComponent("Les autres appareils sont déconnectés.")); }
  const label = (s: (typeof list)[number]) => `${s.kind === "APP" ? "Application" : "Navigateur"} · ${(s.device ?? "appareil inconnu").slice(0, 40)}`;
  return (
    <section className="card space-y-3"><h2 className="text-xl font-semibold">Appareils connectés</h2>
      <ul className="space-y-1 text-sm">{list.map((s) => <li key={s.id}>{label(s)} · actif {s.lastSeenAt.toLocaleString("fr-CH", { timeZone: TZ, dateStyle: "short", timeStyle: "short" })}{s.id === currentSid && <strong> (cet appareil)</strong>}</li>)}</ul>
      {list.length > 1 && <form action={logoutOthers}><button className="btn-ghost">Déconnecter tous les autres appareils</button></form>}</section>
  );
}
