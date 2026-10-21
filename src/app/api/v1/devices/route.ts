import { z } from "zod";
import { apiUser, json, apiError } from "@/lib/api-auth";
import { db } from "@/lib/db";
// Enregistrement du jeton de notifications push de l'appareil (FCM). Un jeton appartient à un seul utilisateur à la fois.
export async function POST(req: Request) {
  const u = await apiUser(req); if (!u) return apiError("Non connecté", 401);
  const p = z.object({ platform: z.enum(["ios", "android", "web"]), token: z.string().min(20).max(400) }).safeParse(await req.json().catch(() => null)); if (!p.success) return apiError("Données invalides");
  await db.device.upsert({ where: { token: p.data.token }, update: { userId: u.id, platform: p.data.platform, lastSeenAt: new Date() }, create: { userId: u.id, platform: p.data.platform, token: p.data.token } });
  return json({ ok: true });
}
export async function DELETE(req: Request) {
  const u = await apiUser(req); if (!u) return apiError("Non connecté", 401);
  const token = String((await req.json().catch(() => ({})))?.token ?? ""); await db.device.deleteMany({ where: { token, userId: u.id } }); return json({ ok: true });
}
