import { NextResponse } from "next/server";
import { verifyWebhook } from "@/modules/payments/provider";
import { confirmPaymentEvent } from "@/lib/booking-service";
import { logSecurity } from "@/lib/security";

// Webhook du prestataire de paiement : signature vérifiée (HMAC + tolérance horaire), événements dédoublonnés par id.
export async function POST(req: Request) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "non configuré" }, { status: 503 });
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("x-gobarber-signature"), secret)) { await logSecurity("WEBHOOK_BAD_SIGNATURE", "HIGH", { ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null }); return NextResponse.json({ error: "signature invalide" }, { status: 400 }); }
  let ev: { id?: string; type?: string; bookingId?: string };
  try { ev = JSON.parse(raw); } catch { return NextResponse.json({ error: "json" }, { status: 400 }); }
  if (!ev.id || !ev.type) return NextResponse.json({ error: "événement invalide" }, { status: 400 });
  return NextResponse.json({ result: await confirmPaymentEvent(ev.id, ev.type, ev.bookingId) });
}
