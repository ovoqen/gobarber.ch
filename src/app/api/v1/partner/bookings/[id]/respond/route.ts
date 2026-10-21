import { z } from "zod";
import { apiUser, json, apiError } from "@/lib/api-auth";
import { partnerRespond, BookingError } from "@/lib/booking-service";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser(req); if (!u || u.role !== "PARTNER" || !u.partner) return apiError("Non autorisé", 403);
  const p = z.object({ accept: z.boolean() }).safeParse(await req.json().catch(() => null)); if (!p.success) return apiError("Données invalides");
  try { await partnerRespond((await params).id, u.partner.id, p.data.accept); return json({ ok: true }); } catch (e) { if (e instanceof BookingError) return apiError(e.message, 409); throw e; }
}
