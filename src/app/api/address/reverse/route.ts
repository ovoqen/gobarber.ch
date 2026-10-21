import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

// Géolocalisation (FACULTATIVE) : transforme la position du téléphone en adresse officielle. Les coordonnées ne sont ni stockées ni journalisées ici.
const ENABLED = (process.env.ENABLED_CANTONS ?? "ge").toUpperCase().split(",").map((s) => s.trim());
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`rev:${ip}`, 30, 60_000).ok) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  const u = new URL(req.url), lat = Number(u.searchParams.get("lat")), lon = Number(u.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 45.7 || lat > 47.9 || lon < 5.9 || lon > 10.6) return NextResponse.json({ error: "Position hors de Suisse" }, { status: 400 });
  const d = 0.004;
  try {
    const r = await fetch(`https://api3.geo.admin.ch/rest/services/ech/MapServer/identify?geometry=${lon},${lat}&geometryType=esriGeometryPoint&layers=all:ch.bfs.gebaeude_wohnungs_register&tolerance=40&sr=4326&mapExtent=${lon - d},${lat - d},${lon + d},${lat + d}&imageDisplay=500,500,96&returnGeometry=false&limit=12`, { signal: AbortSignal.timeout(5000) });
    const j = (await r.json()) as { results?: { attributes: { strname_deinr?: string; dplz4?: number; dplzname?: string; gdekt?: string; ggdename?: string } }[] };
    const all = (j.results ?? []).filter((x) => x.attributes.strname_deinr && x.attributes.dplz4);
    if (!all.length) return NextResponse.json({ found: false });
    const inCanton = all.find((x) => ENABLED.includes(String(x.attributes.gdekt)));
    if (!inCanton) return NextResponse.json({ found: false, outside: true });
    const a = inCanton.attributes;
    return NextResponse.json({ found: true, street: a.strname_deinr, zip: String(a.dplz4), city: a.dplzname ?? a.ggdename, lat, lon });
  } catch { return NextResponse.json({ found: false, unavailable: true }); }
}
