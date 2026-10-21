import { apiUser, json, apiError } from "@/lib/api-auth";
import { revokeSession } from "@/lib/sessions";
import { db } from "@/lib/db";
export async function POST(req: Request) {
  const u = await apiUser(req); if (!u) return apiError("Non connecté", 401);
  await revokeSession(u.sid);
  const body = await req.json().catch(() => ({})); if (typeof body?.pushToken === "string") await db.device.deleteMany({ where: { token: body.pushToken, userId: u.id } }); // plus de notifications sur cet appareil
  return json({ ok: true });
}
