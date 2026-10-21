// Rôles et permissions. Toujours vérifiés côté serveur (le middleware ne sert que de premier filtre).
export type Role = "CLIENT" | "PARTNER" | "ADMIN" | "SUPPORT";
export const STAFF: Role[] = ["ADMIN", "SUPPORT"];
const PERMS = {
  "admin.view": ["ADMIN", "SUPPORT"],
  "partners.manage": ["ADMIN"],
  "bookings.manage": ["ADMIN", "SUPPORT"],
  "payments.manage": ["ADMIN"],
  "catalog.manage": ["ADMIN"],
  "promos.manage": ["ADMIN"],
  "reviews.moderate": ["ADMIN", "SUPPORT"],
  "content.manage": ["ADMIN"],
  "settings.manage": ["ADMIN"],
  "users.manage": ["ADMIN"],
  "audit.view": ["ADMIN"],
  "export.accounting": ["ADMIN"],
} as const satisfies Record<string, Role[]>;
export type Permission = keyof typeof PERMS;
export const can = (role: string, p: Permission) => (PERMS[p] as readonly string[]).includes(role);
