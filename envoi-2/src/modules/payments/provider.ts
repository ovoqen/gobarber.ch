// Abstraction du prestataire de paiement. AUCUN numéro de carte ne transite par nos serveurs :
// avec Stripe, carte / Apple Pay / Google Pay / TWINT sont saisis dans le « Payment Element » hébergé par Stripe ;
// nous ne recevons que des références (PaymentIntent, Transfer).
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

export type AuthResult = { ok: true; ref: string } | { ok: false; reason: string };
export type Intent = { id: string; clientSecret: string };
export interface PaymentProvider {
  readonly name: "demo" | "stripe";
  /** true : le client confirme le paiement dans l'interface du prestataire (Stripe) ; false : autorisation immédiate (démonstration). */
  readonly interactive: boolean;
  /** « manual » : l'argent est seulement réservé puis encaissé à l'acceptation du barbier. « automatic » : encaissé tout de suite, remboursé si refus (obligatoire pour TWINT). */
  readonly captureMode: "manual" | "automatic";
  authorize(p: { amountCents: number; idempotencyKey: string; simulateFailure?: boolean }): Promise<AuthResult>;
  createIntent?(p: { amountCents: number; idempotencyKey: string; bookingId: string; description: string }): Promise<Intent>;
  capture(ref: string, amountCents: number): Promise<void>;
  release(ref: string): Promise<void>;
  refund(ref: string, amountCents: number): Promise<void>;
  /** Versement au barbier (Stripe Connect). Renvoie la référence du transfert. */
  transfer?(p: { amountCents: number; destination: string; idempotencyKey: string; description: string }): Promise<string>;
}

/** Fournisseur de DÉMONSTRATION : aucun mouvement d'argent réel. */
export class DemoProvider implements PaymentProvider {
  readonly name = "demo" as const; readonly interactive = false; readonly captureMode = "manual" as const;
  private seen = new Map<string, string>();
  async authorize(p: { amountCents: number; idempotencyKey: string; simulateFailure?: boolean }): Promise<AuthResult> {
    const prev = this.seen.get(p.idempotencyKey);
    if (prev) return { ok: true, ref: prev };
    if (p.simulateFailure) return { ok: false, reason: "Paiement refusé (simulation)." };
    const ref = `demo_pi_${randomUUID()}`; this.seen.set(p.idempotencyKey, ref);
    return { ok: true, ref };
  }
  async capture() {} async release() {} async refund() {}
  async transfer() { return `demo_tr_${Date.now()}`; }
}

const form = (o: Record<string, string | number | undefined>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v !== undefined) p.append(k, String(v)); return p.toString(); };

/** Stripe via l'API REST (sans SDK). Clés : STRIPE_SECRET_KEY (sk_test_… puis sk_live_…). */
export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const; readonly interactive = true;
  constructor(private key: string, readonly captureMode: "manual" | "automatic" = "manual", private base = "https://api.stripe.com/v1") {}
  private async call<T = Record<string, unknown>>(path: string, body: Record<string, string | number | undefined>, idem?: string): Promise<T> {
    const r = await fetch(`${this.base}${path}`, { method: "POST", headers: { authorization: `Bearer ${this.key}`, "content-type": "application/x-www-form-urlencoded", ...(idem ? { "idempotency-key": idem } : {}) }, body: form(body), signal: AbortSignal.timeout(15000) });
    const j = (await r.json()) as { error?: { message?: string } } & T;
    if (!r.ok) throw new Error(`Stripe : ${j.error?.message ?? r.status}`);
    return j;
  }
  async authorize(): Promise<AuthResult> { return { ok: false, reason: "Le paiement se confirme dans l'interface sécurisée du prestataire." }; }
  async createIntent(p: { amountCents: number; idempotencyKey: string; bookingId: string; description: string }): Promise<Intent> {
    const j = await this.call<{ id: string; client_secret: string }>("/payment_intents", { amount: p.amountCents, currency: "chf", capture_method: this.captureMode, "automatic_payment_methods[enabled]": "true", "metadata[bookingId]": p.bookingId, description: p.description }, p.idempotencyKey);
    return { id: j.id, clientSecret: j.client_secret };
  }
  async capture(ref: string, amountCents: number) { await this.call(`/payment_intents/${ref}/capture`, { amount_to_capture: amountCents }, `cap-${ref}`); }
  async release(ref: string) { await this.call(`/payment_intents/${ref}/cancel`, {}, `rel-${ref}`); }
  async refund(ref: string, amountCents: number) { await this.call("/refunds", { payment_intent: ref, amount: amountCents }, `ref-${ref}-${amountCents}`); }
  async transfer(p: { amountCents: number; destination: string; idempotencyKey: string; description: string }) {
    return (await this.call<{ id: string }>("/transfers", { amount: p.amountCents, currency: "chf", destination: p.destination, description: p.description }, p.idempotencyKey)).id;
  }
  /** Connect Express : crée le compte du barbier (une fois) puis un lien d'inscription hébergé par Stripe (IBAN, identité : jamais chez nous). */
  async createConnectAccount(email: string) { return (await this.call<{ id: string }>("/accounts", { type: "express", country: "CH", email, "capabilities[transfers][requested]": "true", business_type: "individual" })).id; }
  async accountLink(account: string, returnUrl: string, refreshUrl: string) { return (await this.call<{ url: string }>("/account_links", { account, type: "account_onboarding", return_url: returnUrl, refresh_url: refreshUrl })).url; }
}

let provider: PaymentProvider | null = null;
export function getProvider(): PaymentProvider {
  if (provider) return provider;
  if ((process.env.PAYMENT_PROVIDER ?? "demo") === "demo") return (provider = new DemoProvider());
  if (process.env.PAYMENT_PROVIDER === "stripe") {
    const k = process.env.STRIPE_SECRET_KEY; if (!k) throw new Error("STRIPE_SECRET_KEY manquant");
    if (process.env.NODE_ENV === "production" && !k.startsWith("sk_live_")) throw new Error("En production, utilisez une clé sk_live_ (ou une clé restreinte rk_live_)");
    return (provider = new StripeProvider(k, process.env.STRIPE_CAPTURE_MODE === "automatic" ? "automatic" : "manual"));
  }
  throw new Error("PAYMENT_PROVIDER inconnu (demo | stripe)");
}
/** Le paiement en ligne est-il réellement utilisable sur ce serveur ? (démo toujours ; Stripe seulement si les clés et le webhook sont configurés) */
export function paymentsReady() {
  const p = process.env.PAYMENT_PROVIDER ?? "demo";
  return p === "demo" || (p === "stripe" && !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}
export function setProviderForTests(p: PaymentProvider | null) { provider = p; }

/** Signature HMAC-SHA256 `t=…,v1=…` — même schéma que Stripe, donc utilisable pour les webhooks Stripe ET les nôtres. */
export function signWebhook(body: string, secret: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}
export function verifyWebhook(body: string, header: string | null, secret: string, toleranceSec = 300, now = Date.now()) {
  if (!header) return false;
  const parts = header.split(",").map((kv) => kv.split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]); const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex"));
  return sigs.some((s) => { const got = Buffer.from(s); return expected.length === got.length && timingSafeEqual(expected, got); });
}
