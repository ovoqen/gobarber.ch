import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { createBooking, BookingError, expireStale } from "@/lib/booking-service";
import { rateLimit } from "@/lib/rate-limit";
import { sameOrigin } from "@/lib/csrf";

const schema = z.object({
  quantities: z.record(z.string(), z.number().int().min(1).max(6)).optional(), people: z.number().int().min(1).max(8).optional(),
  partnerId: z.string().min(1), serviceIds: z.array(z.string()).min(1).max(6), mode: z.enum(["ASAP", "SCHEDULED"]), startsAt: z.string().datetime().optional(),
  address: z.object({ street: z.string().trim().min(3).max(120), zip: z.string().regex(/^[1-9]\d{3}$/), city: z.string().trim().min(2).max(60), access: z.string().max(200).optional().nullable(), lat: z.number().min(45.7).max(47.9).optional().nullable(), lng: z.number().min(5.9).max(10.6).optional().nullable() }),
  promoCode: z.string().max(30).optional().nullable(),
});
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origine refusée" }, { status: 403 });
  const user = await getUser();
  if (!user || user.role !== "CLIENT") return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  if (!user.emailVerifiedAt) return NextResponse.json({ error: "Confirmez d'abord votre adresse e-mail (lien envoyé à l'inscription)." }, { status: 403 });
  if (!rateLimit(`book:${user.id}`, 20, 3600_000).ok) return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  try {
    await expireStale();
    const b = await createBooking({ ...p.data, clientId: user.id, startsAt: p.data.startsAt ? new Date(p.data.startsAt) : undefined });
    return NextResponse.json({ id: b.id, paymentMode: b.paymentMode });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
