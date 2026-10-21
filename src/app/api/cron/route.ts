import { NextResponse } from "next/server";
import { expireStale } from "@/lib/booking-service";
// À appeler toutes les minutes par un cron (voir docs/DEPLOIEMENT.md) : Authorization: Bearer $CRON_SECRET.
export async function POST(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "interdit" }, { status: 403 });
  return NextResponse.json({ expired: await expireStale() });
}
