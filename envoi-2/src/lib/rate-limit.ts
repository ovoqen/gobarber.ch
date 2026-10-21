// Limiteur de débit. En mémoire par défaut (une seule instance) ; PARTAGÉ via Redis (Upstash REST) si UPSTASH_REDIS_REST_URL / _TOKEN sont définis
// → indispensable dès qu'il y a plusieurs serveurs, sinon un attaquant contourne la limite en changeant de serveur.
const hits = new Map<string, number[]>();
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { hits.set(key, arr); return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - arr[0])) / 1000) }; }
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return { ok: true, retryAfterSec: 0 };
}
export async function rateLimitShared(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterSec: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return rateLimit(key, limit, windowMs);
  try {
    const k = `rl:${key}`;
    const r = await fetch(`${url}/pipeline`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify([["INCR", k], ["PEXPIRE", k, windowMs, "NX"], ["PTTL", k]]), signal: AbortSignal.timeout(1500) });
    const [[, count], , [, ttl]] = (await r.json()) as [[null, number], unknown, [null, number]];
    return count > limit ? { ok: false, retryAfterSec: Math.ceil(Math.max(ttl, 0) / 1000) } : { ok: true, retryAfterSec: 0 };
  } catch { return rateLimit(key, limit, windowMs); } // Redis indisponible : on retombe sur la limite locale (jamais « tout ouvert »)
}
