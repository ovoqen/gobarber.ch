import { apiUser, json, apiError } from "@/lib/api-auth";
import { cancelBooking, BookingError } from "@/lib/booking-service";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser(req); if (!u) return apiError("Non connecté", 401);
  const reason = String((await req.json().catch(() => ({})))?.reason ?? "").slice(0, 300);
  try { const out = await cancelBooking((await params).id, u.role === "PARTNER" ? "PARTNER" : "CLIENT", u.role === "PARTNER" ? (u.partner?.id ?? "-") : u.id, reason); return json(out); }
  catch (e) { if (e instanceof BookingError) return apiError(e.message, 409); throw e; }
}
