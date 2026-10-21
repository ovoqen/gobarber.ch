import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { startPayment, BookingError } from "@/lib/booking-service";
import { sameOrigin } from "@/lib/csrf";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origine refusée" }, { status: 403 });
  const user = await getUser();
  if (!user || user.role !== "CLIENT") return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    // simulateFailure n'existe qu'avec le fournisseur de démonstration.
    const sim = process.env.PAYMENT_PROVIDER === "demo" || !process.env.PAYMENT_PROVIDER ? body?.simulateFailure === true : false;
    const r = await startPayment((await params).id, user.id, sim);
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
