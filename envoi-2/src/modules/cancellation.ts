// Politique d'annulation / remboursement. Valeurs par défaut = HYPOTHÈSES à valider (modifiables dans Admin → Paramètres).
export type CancelPolicy = {
  freeBeforeHours: number;      // annulation gratuite jusqu'à X h avant le rendez-vous
  lateFeePercent: number;       // frais entre `lateWindowHours` et `freeBeforeHours`
  lateWindowHours: number;      // en dessous : frais pleins
  graceMinutesAfterAccept: number; // annulation gratuite juste après acceptation
};
export const DEFAULT_POLICY: CancelPolicy = { freeBeforeHours: 24, lateFeePercent: 50, lateWindowHours: 2, graceMinutesAfterAccept: 5 };

export type CancelInput = {
  by: "CLIENT" | "PARTNER" | "ADMIN" | "SYSTEM";
  status: string; totalCents: number; travelFeeCents: number;
  startsAt: Date; acceptedAt?: Date | null; now: Date; policy?: CancelPolicy;
};
/** `chargeCents` = montant conservé (encaissé), le reste est remboursé / l'autorisation libérée. */
export type CancelOutcome = { chargeCents: number; refundCents: number; reason: string; flagPartner: boolean };

export function computeCancellation(i: CancelInput): CancelOutcome {
  const p = i.policy ?? DEFAULT_POLICY;
  const full = (reason: string, flagPartner = false): CancelOutcome => ({ chargeCents: 0, refundCents: i.totalCents, reason, flagPartner });
  // Tout ce qui est imputable au barbier ou à la plateforme : remboursement intégral.
  if (i.by === "PARTNER") return full("Annulation par le barbier : remboursement intégral.", i.status !== "REQUESTED");
  if (i.by === "SYSTEM" || i.by === "ADMIN") return full("Annulation par la plateforme : remboursement intégral.");
  if (["PENDING_PAYMENT", "REQUESTED"].includes(i.status)) return full("Demande non encore acceptée : aucun frais.");
  if (i.acceptedAt && i.now.getTime() - i.acceptedAt.getTime() <= p.graceMinutesAfterAccept * 60_000)
    return full("Annulation dans les minutes suivant l'acceptation : aucun frais.");
  if (i.status === "EN_ROUTE" || i.status === "IN_PROGRESS") return { chargeCents: i.totalCents, refundCents: 0, reason: "Barbier déjà en route : montant dû.", flagPartner: false };
  const hours = (i.startsAt.getTime() - i.now.getTime()) / 3_600_000;
  if (hours >= p.freeBeforeHours) return full(`Annulation plus de ${p.freeBeforeHours} h à l'avance : aucun frais.`);
  if (hours >= p.lateWindowHours) {
    const charge = Math.round((i.totalCents * p.lateFeePercent) / 100);
    return { chargeCents: charge, refundCents: i.totalCents - charge, reason: `Annulation tardive : ${p.lateFeePercent} % du montant retenu.`, flagPartner: false };
  }
  return { chargeCents: i.totalCents, refundCents: 0, reason: `Annulation moins de ${p.lateWindowHours} h avant : montant dû.`, flagPartner: false };
}
