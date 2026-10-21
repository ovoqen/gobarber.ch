"use client";
import { useEffect, useState } from "react";

/** Dans l'application native uniquement : propose d'activer les notifications (permission demandée au clic, jamais à l'ouverture — exigence des stores). */
export default function PushPrompt() {
  const [state, setState] = useState<"hidden" | "ask" | "done" | "denied">("hidden");
  useEffect(() => {
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core"); if (!Capacitor.isNativePlatform()) return;
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const perm = await PushNotifications.checkPermissions();
        if (perm.receive === "granted") { await register(PushNotifications, Capacitor.getPlatform()); setState("done"); } else if (perm.receive === "denied") setState("denied"); else setState("ask");
        // Toucher une notification ouvre la page concernée (chemin interne uniquement : jamais d'URL externe).
        PushNotifications.addListener("pushNotificationActionPerformed", (a) => { const href = a.notification.data?.href; if (typeof href === "string" && /^\/(?!\/)/.test(href)) window.location.assign(href); });
      } catch { /* pas dans l'application native */ }
    })();
  }, []);
  async function enable() {
    const { Capacitor } = await import("@capacitor/core"); const { PushNotifications } = await import("@capacitor/push-notifications");
    const r = await PushNotifications.requestPermissions();
    if (r.receive === "granted") { await register(PushNotifications, Capacitor.getPlatform()); setState("done"); } else setState("denied");
  }
  if (state === "hidden" || state === "done") return null;
  return (
    <div role="region" aria-label="Notifications" className="container-x pt-6">
      <div className="card flex flex-wrap items-center justify-between gap-3 !border-gold/50">
        {state === "ask" ? <><p className="text-sm">Recevez une notification quand un barbier accepte, part en route ou termine. Vous pouvez la désactiver à tout moment.</p><button className="btn-gold" onClick={enable}>Activer les notifications</button></>
          : <p className="text-sm text-muted">Notifications désactivées. Pour les activer : Réglages du téléphone → GoBarber → Notifications.</p>}
      </div>
    </div>
  );
}
type Push = typeof import("@capacitor/push-notifications").PushNotifications;
async function register(PN: Push, platform: string) {
  await PN.removeAllListeners();
  await PN.addListener("registration", async (t) => { await fetch("/api/push/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform: platform === "ios" ? "ios" : "android", token: t.value }) }); });
  await PN.register();
}
