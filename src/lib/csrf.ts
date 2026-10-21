// Protection CSRF des routes d'API appelées avec le cookie de session : l'en-tête Origin doit correspondre à notre domaine.
// (Les actions de formulaire Next.js vérifient déjà Origin ; les requêtes avec jeton Bearer — application mobile — n'utilisent pas de cookie.)
export function sameOrigin(req: Request): boolean {
  if (req.headers.get("authorization")?.startsWith("Bearer ")) return true;
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site"; // requêtes serveur-à-serveur / anciens navigateurs
  try { return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host")); } catch { return false; }
}
