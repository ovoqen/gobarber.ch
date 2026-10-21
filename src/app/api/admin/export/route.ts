import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
const esc = (v: unknown) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; }; // anti-injection de formules CSV
export async function GET() {
  const u = await requireStaff("export.accounting");
  const rows = await db.booking.findMany({ where: { status: { in: ["COMPLETED", "NO_SHOW_CLIENT", "CANCELLED"] } }, include: { partner: true }, orderBy: { startsAt: "desc" }, take: 20000 });
  const head = ["numero", "date", "statut", "barbier", "sous_total_chf", "remise_chf", "deplacement_chf", "total_chf", "commission_chf", "net_barbier_chf", "rembourse_chf"];
  const c = (n: number) => (n / 100).toFixed(2);
  const lines = rows.map((b) => [b.number, b.startsAt.toISOString(), b.status, b.partner.displayName, c(b.subtotalCents), c(b.discountCents), c(b.travelFeeCents), c(b.totalCents), c(b.commissionCents), c(b.partnerNetCents), c(b.refundCents)].map(esc).join(","));
  await audit(u.id, "export.accounting", "Booking", null, { rows: rows.length });
  return new NextResponse([head.join(","), ...lines].join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="comptabilite-gobarber.csv"' } });
}
