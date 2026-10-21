import { apiUser, json, apiError } from "@/lib/api-auth";
import { expireStale } from "@/lib/booking-service";
import { load, viewBooking } from "@/lib/api-bookings";
export async function GET(req: Request) {
  const u = await apiUser(req); if (!u || u.role !== "PARTNER" || !u.partner) return apiError("Non autorisé", 403); await expireStale();
  return json({ requests: (await load({ partnerId: u.partner.id, status: "REQUESTED" })).map((b) => viewBooking(b, "PARTNER")) });
}
