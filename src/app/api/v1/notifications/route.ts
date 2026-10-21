import { apiUser, json, apiError } from "@/lib/api-auth";
import { db } from "@/lib/db";
export async function GET(req: Request) {
  const u = await apiUser(req); if (!u) return apiError("Non connecté", 401);
  return json({ notifications: await db.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, title: true, body: true, href: true, readAt: true, createdAt: true } }) });
}
