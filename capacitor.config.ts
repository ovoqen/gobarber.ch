import type { CapacitorConfig } from "@capacitor/cli";

// Coque native iOS / Android autour du site GoBarber.ch. L'application charge le site en HTTPS (CAP_SERVER_URL) : une mise à jour du site = mise à jour de l'app,
// sans repasser par les stores. Voir docs/MOBILE.md pour créer les projets natifs (Xcode / Android Studio requis).
const config: CapacitorConfig = {
  appId: "ch.gobarber.app",
  appName: "GoBarber",
  webDir: "public",
  server: process.env.CAP_SERVER_URL ? { url: process.env.CAP_SERVER_URL, cleartext: false, allowNavigation: ["gobarber.ch", "*.gobarber.ch", "js.stripe.com", "hooks.stripe.com", "*.stripe.com", "maps.google.com", "www.google.com"] } : undefined,
  ios: { contentInset: "automatic", scheme: "GoBarber" },
  android: { allowMixedContent: false },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};
export default config;
