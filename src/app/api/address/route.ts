import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

// Autocomplétion d'adresses via le registre officiel suisse (swisstopo / geo.admin.ch) : gratuit, sans clé, adresses réelles + coordonnées.
// Lancement restreint au CANTON DE GENÈVE (toutes ses communes). Pour ouvrir un autre canton : ajouter son code dans ENABLED_CANTONS.
const ENABLED_CANTONS = (process.env.ENABLED_CANTONS ?? "ge").toLowerCase().split(",").map((s) => s.trim());
type Hit = { kind: "address" | "place"; label: string; street?: string; zip?: string; city?: string; lat: number; lon: number };
type Raw = { attrs: { label: string; detail: string; lat: number; lon: number } };
const BASE = "https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&sr=4326";
const strip = (s: string) => s.replace(/<[^>]*>/g, "").trim();
const inCanton = (r: Raw) => ENABLED_CANTONS.some((c) => new RegExp(`\\s${c}$`).test(r.attrs.detail.trim())); // detail se termine par le code du canton
const clean = (s: string) => s.replace(/\s+GE$/, ""); // « Carouge GE » → « Carouge »

async function q(origins: string, text: string, limit: number): Promise<Raw[]> {
  const r = await fetch(`${BASE}&origins=${origins}&limit=${limit}&searchText=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(4000), next: { revalidate: 3600 } });
  return r.ok ? (((await r.json()).results ?? []) as Raw[]) : [];
}

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`addr:${ip}`, 90, 60_000).ok) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  const text = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (text.length < 2) return NextResponse.json({ hits: [] });
  try {
    const digits = /^\d{3,4}/.test(text);
    // On interroge large puis on filtre sur le canton (la recherche seule mélange les cantons : « Perly », « Lancy »… existent aussi ailleurs).
    const [addr, zips, places] = await Promise.all([q("address", `${text} ge`, 25), digits ? q("zipcode", text.slice(0, 4), 3) : [], /^\D+$/.test(text) ? q("gg25", text, 10) : []]);
    const rawCount = addr.length + zips.length + places.length;
    const hits: Hit[] = [];
    for (const r of addr.filter(inCanton).slice(0, 7)) {
      const label = clean(strip(r.attrs.label)), m = label.match(/^(.*\S)\s+(\d{4})\s+(.+)$/);
      if (m) hits.push({ kind: "address", label, street: m[1], zip: m[2], city: m[3], lat: r.attrs.lat, lon: r.attrs.lon });
    }
    for (const r of places.filter(inCanton)) { const n = clean(strip(r.attrs.label).replace(/\s*\([A-Z]{2}\)$/, "")); hits.push({ kind: "place", label: n, city: n, lat: r.attrs.lat, lon: r.attrs.lon }); }
    // Un NPA n'a pas de canton dans la réponse : on ne le propose que si une adresse du canton existe à ce NPA.
    for (const r of zips) { const m = strip(r.attrs.label).match(/^(\d{4})\s*-\s*(.+)$/); if (m && addr.some((a) => inCanton(a) && a.attrs.label.includes(` ${m[1]} `) || a.attrs.label.includes(`<b>${m[1]} `))) hits.push({ kind: "place", label: `${m[1]} ${clean(m[2])}`, zip: m[1], city: clean(m[2]), lat: r.attrs.lat, lon: r.attrs.lon }); }
    if (!/\d/.test(text)) hits.sort((a, b) => Number(b.kind === "place") - Number(a.kind === "place")); // nom de localité seul : localités d'abord
    return NextResponse.json({ hits: hits.slice(0, 9), outside: hits.length === 0 && rawCount > 0 });
  } catch { return NextResponse.json({ hits: [], unavailable: true }); }
}
