import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { readUpload } from "@/lib/storage";
import { audit } from "@/lib/audit";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireStaff("partners.manage");
  const d = await db.partnerDocument.findUnique({ where: { id: (await params).id } }); if (!d) return new Response(null, { status: 404 });
  await audit(u.id, "document.view", "PartnerDocument", d.id); // consultation de pièce d'identité = tracée
  const f = await readUpload(d.fileRef); return new Response(new Uint8Array(f.data), { headers: { "content-type": f.type, "content-disposition": "inline", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
