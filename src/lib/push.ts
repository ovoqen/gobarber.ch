import { SignJWT, importPKCS8 } from "jose";
import { db } from "./db";

// Notifications push iOS + Android via Firebase Cloud Messaging (API HTTP v1). Configuration : FCM_SERVICE_ACCOUNT_JSON (clé de compte de service Firebase, en une ligne).
// Sans cette variable : aucune push n'est envoyée (les notifications restent dans l'application et par e-mail).
type Sa = { project_id: string; client_email: string; private_key: string };
let cache: { token: string; exp: number } | null = null;

const account = (): Sa | null => { try { return process.env.FCM_SERVICE_ACCOUNT_JSON ? (JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON) as Sa) : null; } catch { return null; } };
export const pushConfigured = () => !!account();

async function accessToken(sa: Sa): Promise<string> {
  if (cache && cache.exp > Date.now() + 60_000) return cache.token;
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" }).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(sa.client_email).setSubject(sa.client_email).setAudience("https://oauth2.googleapis.com/token").setIssuedAt(now).setExpirationTime(now + 3000).sign(await importPKCS8(sa.private_key, "RS256"));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }), signal: AbortSignal.timeout(8000) });
  const j = (await r.json()) as { access_token?: string; expires_in?: number }; if (!j.access_token) throw new Error("FCM: jeton refusé");
  cache = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 }; return j.access_token;
}

/** Envoie une notification à tous les appareils de l'utilisateur. Le texte ne contient JAMAIS d'adresse ni de donnée sensible (visible sur l'écran verrouillé). */
export async function sendPush(userId: string, title: string, body: string, href?: string) {
  const sa = account(); if (!sa) return { sent: 0 };
  const devices = await db.device.findMany({ where: { userId } }); if (!devices.length) return { sent: 0 };
  let sent = 0;
  try {
    const token = await accessToken(sa);
    for (const d of devices) {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ message: { token: d.token, notification: { title, body }, data: href ? { href } : undefined, android: { priority: "high", notification: { channel_id: "gobarber" } }, apns: { payload: { aps: { sound: "default" } } } } }), signal: AbortSignal.timeout(8000) });
      if (r.ok) sent++; else if (r.status === 404 || r.status === 400) { const j = (await r.json().catch(() => ({}))) as { error?: { status?: string } }; if (j.error?.status === "NOT_FOUND" || j.error?.status === "UNREGISTERED") await db.device.delete({ where: { id: d.id } }).catch(() => {}); } // appareil désinstallé
    }
  } catch { /* la push ne doit jamais bloquer une réservation */ }
  return { sent };
}
