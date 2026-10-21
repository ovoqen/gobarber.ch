// Calculs monétaires en centimes entiers (jamais de flottants pour de l'argent).
export type PromoRule = { percentOff?: number | null; amountOffCents?: number | null };
export type Totals = {
  subtotalCents: number; discountCents: number; travelFeeCents: number;
  totalCents: number; commissionCents: number; partnerNetCents: number;
};

/**
 * - La remise s'applique aux prestations uniquement (pas aux frais de déplacement) et ne rend jamais le total négatif.
 * - La commission GoBarber (commissionBps, en points de base : 2000 = 20 %) porte sur les prestations après remise.
 * - Les frais de déplacement reviennent intégralement au barbier. Les frais du prestataire de paiement sont
 *   supportés par GoBarber (prélevés sur la commission) — hypothèse à valider dans le contrat partenaire.
 */
export function computeTotals(itemPrices: number[], travelFeeCents: number, commissionBps: number, promo?: PromoRule | null): Totals {
  for (const p of [...itemPrices, travelFeeCents]) if (!Number.isInteger(p) || p < 0) throw new Error("Montant invalide");
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10000) throw new Error("Commission invalide");
  const subtotalCents = itemPrices.reduce((a, b) => a + b, 0);
  let discountCents = 0;
  if (promo?.percentOff) discountCents = Math.round((subtotalCents * Math.min(100, promo.percentOff)) / 100);
  else if (promo?.amountOffCents) discountCents = promo.amountOffCents;
  discountCents = Math.min(discountCents, subtotalCents);
  const net = subtotalCents - discountCents;
  const commissionCents = Math.round((net * commissionBps) / 10000);
  const totalCents = net + travelFeeCents;
  return { subtotalCents, discountCents, travelFeeCents, totalCents, commissionCents, partnerNetCents: totalCents - commissionCents };
}

export const chf = (cents: number) => `CHF ${(cents / 100).toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
