import { z } from "zod";
import { apiRefresh, apiError } from "@/lib/api-auth";
export async function POST(req: Request) {
  const p = z.object({ refreshToken: z.string().min(20).max(200) }).safeParse(await req.json().catch(() => null));
  return p.success ? apiRefresh(req, p.data.refreshToken) : apiError("Données invalides");
}
