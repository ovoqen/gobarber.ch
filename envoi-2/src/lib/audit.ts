import { db } from "./db";
/** Journal des actions sensibles. Ne jamais y mettre de mot de passe, secret, document ou numéro de carte. */
export async function audit(userId: string | null | undefined, action: string, entity: string, entityId?: string | null, diff?: unknown) {
  await db.auditLog.create({ data: { userId: userId ?? null, action, entity, entityId: entityId ?? null, diff: diff === undefined ? null : JSON.stringify(diff).slice(0, 4000) } });
}
