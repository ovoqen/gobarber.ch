import { z } from "zod";
import { apiLogin, apiError } from "@/lib/api-auth";
export async function POST(req: Request) {
  const p = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200), device: z.string().max(120).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return apiError("Données invalides");
  return apiLogin(req, p.data.email, p.data.password, p.data.device);
}
