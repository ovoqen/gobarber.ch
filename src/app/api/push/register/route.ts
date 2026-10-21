import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sameOrigin } from "@/lib/csrf";
// Enregistre le jeton push de l'appareil pour l'utilisateur connecté (session web de la coque native). Contrôle d'origine + cookie de session.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origine refusée" }, { status: 403 });
  const u = await getUser(); if (!u) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const p = z.object({ platform: z.enum(["ios", "android"]), token: z.string().min(20).max(400) }).safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  await db.device.upsert({ where: { token: p.data.token }, update: { userId: u.id, platform: p.data.platform, lastSeenAt: new Date() }, create: { userId: u.id, platform: p.data.platform, token: p.data.token } });
  return NextResponse.json({ ok: true });
}
