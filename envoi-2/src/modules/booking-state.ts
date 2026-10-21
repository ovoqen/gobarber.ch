// Machine à états des réservations. Toute modification de statut passe par `canTransition`.
export const STATUSES = [
  "PENDING_PAYMENT", // créée, en attente de l'autorisation de paiement (créneau retenu 10 min)
  "REQUESTED",       // demande envoyée au barbier (paiement autorisé)
  "ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED",
  "CANCELLED", "REFUSED", "EXPIRED", "NO_SHOW_CLIENT", "NO_SHOW_PARTNER",
] as const;
export type BookingStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "Paiement en attente", REQUESTED: "Demande envoyée", ACCEPTED: "Acceptée",
  EN_ROUTE: "Barbier en route", IN_PROGRESS: "Prestation commencée", COMPLETED: "Terminée",
  CANCELLED: "Annulée", REFUSED: "Refusée par le barbier", EXPIRED: "Expirée (sans réponse)",
  NO_SHOW_CLIENT: "Client absent", NO_SHOW_PARTNER: "Barbier absent",
};

const NEXT: Record<BookingStatus, BookingStatus[]> = {
  PENDING_PAYMENT: ["REQUESTED", "CANCELLED", "EXPIRED"],
  REQUESTED: ["ACCEPTED", "REFUSED", "EXPIRED", "CANCELLED"],
  ACCEPTED: ["EN_ROUTE", "CANCELLED", "NO_SHOW_PARTNER"],
  EN_ROUTE: ["IN_PROGRESS", "CANCELLED", "NO_SHOW_CLIENT", "NO_SHOW_PARTNER"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [], CANCELLED: [], REFUSED: [], EXPIRED: [], NO_SHOW_CLIENT: [], NO_SHOW_PARTNER: [],
};

export const canTransition = (from: string, to: string) => (NEXT[from as BookingStatus] ?? []).includes(to as BookingStatus);
export const isTerminal = (s: string) => (NEXT[s as BookingStatus] ?? ["x" as BookingStatus]).length === 0;
/** Statuts qui occupent le planning du barbier. */
export const BLOCKING: BookingStatus[] = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];
export const HOLD_MINUTES = 10;
