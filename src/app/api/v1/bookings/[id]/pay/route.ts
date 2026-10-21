import { apiUser, json, apiError } from "@/lib/api-auth";
import { startPayment, BookingError } from "@/lib/booking-service";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser(req); if (!u || u.role !== "CLIENT") return apiError("Non connecté", 401);
  try { return json(await startPayment((await params).id, u.id)); } catch (e) { if (e instanceof BookingError) return apiError(e.message, 409); throw e; }
}
