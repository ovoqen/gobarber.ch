import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

/** Politique de sécurité du contenu (CSP) avec « nonce » par requête : seuls nos scripts s'exécutent ; une injection de balise <script> est bloquée. */
function csp(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.google.com https://*.gstatic.com https://*.googleapis.com https://*.ggpht.com",
    "font-src 'self' data:",
    `connect-src 'self' https://api.stripe.com https://*.stripe.com${dev ? " ws: wss:" : ""}`,
    "frame-src https://maps.google.com https://www.google.com https://js.stripe.com https://hooks.stripe.com https://*.stripe.com",
    "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

// Premier filtre d'accès (les droits réels sont revérifiés côté serveur dans chaque page / action).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = btoa(crypto.randomUUID()).replace(/=/g, ""), policy = csp(nonce);
  const needs =
    pathname.startsWith("/admin") && pathname !== "/admin/login" ? "staff" :
    pathname.startsWith("/compte") ? "client" :
    (pathname.startsWith("/partenaire") && pathname !== "/partenaire/inscription") ? "partner" : null;
  if (needs) {
    const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    const login = needs === "staff" ? "/admin/login" : `/connexion?next=${encodeURIComponent(pathname)}`;
    const redirect = (to: string) => NextResponse.redirect(new URL(to, req.url));
    if (!s) return redirect(login);
    if (needs === "staff" && !["ADMIN", "SUPPORT"].includes(s.role)) return redirect("/");
    if (needs === "staff" && !s.mfa && pathname !== "/admin/2fa") return redirect("/admin/2fa");
    if (needs === "client" && s.role !== "CLIENT") return redirect(s.role === "PARTNER" ? "/partenaire" : "/admin");
    if (needs === "partner" && s.role !== "PARTNER") return redirect("/");
  }
  const headers = new Headers(req.headers); headers.set("x-nonce", nonce); headers.set("content-security-policy", policy);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("content-security-policy", policy);
  return res;
}
export const config = { matcher: ["/((?!_next/|api/|favicon|.*\\..*).*)"] };
