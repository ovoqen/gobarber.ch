import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
// Droit d'accès / portabilité : toutes les données de l'utilisateur connecté, et seulement les siennes.
export async function GET() {
  const u = await getUser(); if (!u) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  const [addresses, bookings, messages, notifications] = await Promise.all([
    db.address.findMany({ where: { userId: u.id } }),
    db.booking.findMany({ where: u.role === "PARTNER" ? { partnerId: u.partner?.id } : { clientId: u.id }, include: { items: true, review: true } }),
    db.message.findMany({ where: { senderId: u.id } }), db.notification.findMany({ where: { userId: u.id } }),
  ]);
  const { passwordHash, totpSecret, ...profile } = u as typeof u & { passwordHash: string; totpSecret: string | null }; void passwordHash; void totpSecret;
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), profile: { ...profile, partner: undefined }, addresses, bookings, messages, notifications }, null, 2), { headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="mes-donnees-gobarber.json"' } });
}
