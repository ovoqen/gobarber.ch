import { apiUser, json, apiError } from "@/lib/api-auth";
import { load, viewBooking } from "@/lib/api-bookings";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser(req); if (!u) return apiError("Non connecté", 401); const id = (await params).id;
  // Filtre par propriétaire : l'existence d'une réservation d'autrui n'est jamais révélée (404).
  const [b] = await load(u.role === "PARTNER" ? { id, partnerId: u.partner?.id ?? "-" } : { id, clientId: u.id }, 1);
  return b ? json(viewBooking(b, u.role === "PARTNER" ? "PARTNER" : "CLIENT")) : apiError("Introuvable", 404);
}
