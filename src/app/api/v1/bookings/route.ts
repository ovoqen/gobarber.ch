import { z } from "zod";
import { apiUser, json, apiError } from "@/lib/api-auth";
import { createBooking, expireStale, BookingError } from "@/lib/booking-service";
import { load, viewBooking } from "@/lib/api-bookings";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const u = await apiUser(req); if (!u) return apiError("Non connecté", 401); await expireStale();
  const list = await load(u.role === "PARTNER" ? { partnerId: u.partner?.id ?? "-" } : { clientId: u.id });
  return json({ bookings: list.map((b) => viewBooking(b, u.role === "PARTNER" ? "PARTNER" : "CLIENT")) });
}
const schema = z.object({
  partnerId: z.string().min(1), serviceIds: z.array(z.string()).min(1).max(6), mode: z.enum(["ASAP", "SCHEDULED"]), startsAt: z.string().datetime().optional(),
  quantities: z.record(z.string(), z.number().int().min(1).max(6)).optional(), people: z.number().int().min(1).max(8).optional(),
  address: z.object({ street: z.string().trim().min(3).max(120), zip: z.string().regex(/^[1-9]\d{3}$/), city: z.string().trim().min(2).max(60), access: z.string().max(200).optional().nullable(), lat: z.number().min(45.7).max(47.9).optional().nullable(), lng: z.number().min(5.9).max(10.6).optional().nullable() }),
  promoCode: z.string().max(30).optional().nullable(),
});
export async function POST(req: Request) {
  const u = await apiUser(req); if (!u || u.role !== "CLIENT") return apiError("Non connecté", 401);
  if (!u.emailVerifiedAt) return apiError("Confirmez d'abord votre adresse e-mail.", 403);
  if (!rateLimit(`book:${u.id}`, 20, 3600_000).ok) return apiError("Trop de tentatives", 429);
  const p = schema.safeParse(await req.json().catch(() => null)); if (!p.success) return apiError("Données invalides");
  try { await expireStale(); const b = await createBooking({ ...p.data, clientId: u.id, startsAt: p.data.startsAt ? new Date(p.data.startsAt) : undefined }); return json({ id: b.id, paymentMode: b.paymentMode, status: b.status }, 201); }
  catch (e) { if (e instanceof BookingError) return apiError(e.message, 409); throw e; }
}
