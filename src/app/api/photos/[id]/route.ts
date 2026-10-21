import { db } from "@/lib/db";
import { readUpload } from "@/lib/storage";
// Photo de profil d'un barbier : publique uniquement si le barbier est approuvé.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await db.partner.findUnique({ where: { id: (await params).id } });
  if (!p?.photoUrl || p.status !== "APPROVED") return new Response(null, { status: 404 });
  const f = await readUpload(p.photoUrl).catch(() => null); if (!f) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(f.data), { headers: { "content-type": f.type, "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" } });
}
