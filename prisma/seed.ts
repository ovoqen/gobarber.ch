// Usage : `npm run db:seed` (production-safe : catalogue + contenus + prix) ou `npm run db:seed -- --demo` (comptes et barbiers DE DÉMONSTRATION, jamais en production).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CONTENT } from "./content";
import GE_ZIPS from "../src/data/ge-zips.json";
const db = new PrismaClient();
const demo = process.argv.includes("--demo");

async function main() {
  const services = [
    { code: "coupe", name: "Coupe homme", description: "Coupe aux ciseaux et/ou à la tondeuse, finitions.", durationMin: 30, priceCents: 4500, sort: 1 },
    { code: "barbe", name: "Barbe", description: "Taille et mise en forme de la barbe, rasoir.", durationMin: 20, priceCents: 3000, sort: 2 },
    { code: "coupe-barbe", name: "Coupe + barbe", description: "La formule complète.", durationMin: 50, priceCents: 7000, sort: 3 },
    { code: "coupe-enfant", name: "Coupe enfant (– 12 ans)", description: "Un adulte doit être présent.", durationMin: 25, priceCents: 3500, sort: 4 },
  ];
  for (const s of services) await db.service.upsert({ where: { code: s.code }, update: {}, create: s });
  for (const c of CONTENT) await db.contentPage.upsert({ where: { slug: c.slug }, update: {}, create: c });
  console.log("Catalogue et contenus OK (prix = indicatifs, à valider).");
  if (!demo) return;

  const pw = process.env.SEED_PASSWORD; if (!pw) throw new Error("SEED_PASSWORD manquant");
  const hash = await bcrypt.hash(pw, 11);
  const mk = (email: string, role: string, firstName: string, lastName: string) =>
    db.user.upsert({ where: { email }, update: {}, create: { email, role, firstName, lastName, passwordHash: hash, emailVerifiedAt: new Date() } });
  await mk("admin@gobarber.test", "ADMIN", "Admin", "Démo"); await mk("support@gobarber.test", "SUPPORT", "Support", "Démo");
  await mk("client@gobarber.test", "CLIENT", "Camille", "Démo");
  const all = await db.service.findMany();
  const barbers = [
    { email: "barbier1@gobarber.test", name: "[DÉMO] Barbier Alpha", zips: [["1200", "Genève"], ["1201", "Genève"], ["1203", "Genève"]], instant: true },
    { email: "barbier2@gobarber.test", name: "[DÉMO] Barbier Bravo", zips: [["1000", "Lausanne"], ["1003", "Lausanne"]], instant: false },
  ];
  for (const b of barbers) {
    const u = await mk(b.email, "PARTNER", b.name, "");
    const p = await db.partner.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id, displayName: b.name, bio: "Profil de démonstration — aucun vrai barbier.", status: "APPROVED", instantEnabled: b.instant, onlinePaymentEnabled: b.email !== "barbier2@gobarber.test", baseZip: b.zips[0][0], baseCity: b.zips[0][1], payoutAccountRef: "acct_demo", contractAcceptedAt: new Date(), contractVersion: "demo" } });
    if (!(await db.partnerZone.count({ where: { partnerId: p.id } }))) {
      for (const [zip, city] of b.zips) await db.partnerZone.create({ data: { partnerId: p.id, zip, city, travelFeeCents: 1000 } });
      for (const s of all) await db.partnerService.create({ data: { partnerId: p.id, serviceId: s.id, priceCents: s.priceCents, durationMin: s.durationMin } });
      for (let d = 1; d <= 6; d++) await db.availabilityRule.create({ data: { partnerId: p.id, weekday: d, startMin: 9 * 60, endMin: d === 6 ? 16 * 60 : 19 * 60 } });
    }
  }
  // Qendrim.S : disponible dans TOUTES les communes du canton de Genève (60 NPA), toutes prestations, lundi–samedi.
  {
    const u = await mk("qendrim@gobarber.test", "PARTNER", "Qendrim", "S.");
    const p = await db.partner.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id, displayName: "Qendrim.S", bio: "Barbier à domicile dans tout le canton de Genève.", status: "APPROVED", instantEnabled: true, onlinePaymentEnabled: true, baseZip: "1227", baseCity: "Carouge", payoutAccountRef: "acct_demo", contractAcceptedAt: new Date(), contractVersion: "demo", canManageCalendar: true } });
    for (const z of GE_ZIPS) await db.partnerZone.upsert({ where: { partnerId_zip: { partnerId: p.id, zip: z.zip } }, update: {}, create: { partnerId: p.id, zip: z.zip, city: z.city, travelFeeCents: 1000 } });
    for (const sv of all) await db.partnerService.upsert({ where: { partnerId_serviceId: { partnerId: p.id, serviceId: sv.id } }, update: {}, create: { partnerId: p.id, serviceId: sv.id, priceCents: sv.priceCents, durationMin: sv.durationMin } });
    if (!(await db.availabilityRule.count({ where: { partnerId: p.id } }))) for (let d = 1; d <= 6; d++) await db.availabilityRule.create({ data: { partnerId: p.id, weekday: d, startMin: 8 * 60, endMin: 20 * 60 } });
  }
  await db.promoCode.upsert({ where: { code: "BIENVENUE10" }, update: {}, create: { code: "BIENVENUE10", percentOff: 10, maxUses: 100 } });
  console.log("Comptes DÉMO créés (@gobarber.test), mot de passe = SEED_PASSWORD. Admin : 2FA à activer à la première connexion.");
}
main().finally(() => db.$disconnect());
