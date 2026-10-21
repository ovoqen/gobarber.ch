import { db } from "./db";
import { sendMail } from "./notify";

type Sev = "INFO" | "WARN" | "HIGH";
/** Journal de sécurité + alerte immédiate (e-mail aux administrateurs et webhook Slack/Discord si ALERT_WEBHOOK_URL est défini) pour les événements graves. Jamais de secret dans `detail`. */
export async function logSecurity(type: string, severity: Sev, o: { userId?: string | null; ip?: string | null; detail?: string } = {}) {
  try {
    const recent = severity === "HIGH" ? await db.securityEvent.findFirst({ where: { type, alerted: true, ip: o.ip ?? null, userId: o.userId ?? null, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } } }) : null;
    const ev = await db.securityEvent.create({ data: { type, severity, userId: o.userId ?? null, ip: o.ip ?? null, detail: o.detail?.slice(0, 300) ?? null, alerted: severity === "HIGH" && !recent } });
    if (severity === "HIGH" && !recent) await alert(ev.type, o);
  } catch { /* la sécurité ne doit jamais casser la requête */ }
}
async function alert(type: string, o: { userId?: string | null; ip?: string | null; detail?: string }) {
  const text = `🚨 GoBarber.ch — alerte de sécurité : ${type}${o.ip ? ` · IP ${o.ip}` : ""}${o.detail ? ` · ${o.detail}` : ""}`;
  const admins = await db.user.findMany({ where: { role: "ADMIN", active: true, deletedAt: null }, select: { email: true } });
  const to = process.env.ALERT_EMAIL ? [process.env.ALERT_EMAIL] : admins.map((a) => a.email);
  await Promise.allSettled(to.map((e) => sendMail(e, `Alerte de sécurité : ${type}`, `${text}\n\nConsultez Administration → Sécurité.`)));
  if (process.env.ALERT_WEBHOOK_URL) await fetch(process.env.ALERT_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(4000) }).catch(() => {});
}
/** Rafales d'échecs depuis une même IP (attaque par force brute / bourrage d'identifiants). */
export async function checkBruteForce(ip: string) {
  const n = await db.securityEvent.count({ where: { type: "LOGIN_FAILED", ip, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
  if (n >= 15) await logSecurity("BRUTE_FORCE_SUSPECTED", "HIGH", { ip, detail: `${n} échecs de connexion en 10 min` });
}
