import { NextResponse } from "next/server";
import { verifyWebhook } from "@/modules/payments/provider";
import { handleStripeEvent } from "@/lib/booking-service";
import { logSecurity } from "@/lib/security";

// Webhook Stripe : signature vérifiée (HMAC SHA-256, tolérance 5 min), événements dédoublonnés. Configurer dans Stripe : /api/webhooks/stripe
// Événements à activer : payment_intent.amount_capturable_updated, payment_intent.succeeded, payment_intent.payment_failed, account.updated
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "non configuré" }, { status: 503 });
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("stripe-signature"), secret)) {
    await logSecurity("WEBHOOK_BAD_SIGNATURE", "HIGH", { ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null, detail: "stripe" });
    return NextResponse.json({ error: "signature invalide" }, { status: 400 });
  }
  let ev: { id: string; type: string; data: { object: Record<string, unknown> } };
  try { ev = JSON.parse(raw); } catch { return NextResponse.json({ error: "json" }, { status: 400 }); }
  if (!ev.id || !ev.type || !ev.data?.object) return NextResponse.json({ error: "événement invalide" }, { status: 400 });
  try { return NextResponse.json({ result: await handleStripeEvent(ev) }); }
  catch { return NextResponse.json({ error: "traitement" }, { status: 500 }); } // Stripe réessaiera
}
