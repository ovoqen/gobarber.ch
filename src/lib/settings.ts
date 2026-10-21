import { db } from "./db";
import { DEFAULT_POLICY, type CancelPolicy } from "@/modules/cancellation";

export const SETTING_DEFAULTS = {
  commissionBps: "2000",            // 20 % — HYPOTHÈSE à confirmer
  freeBeforeHours: String(DEFAULT_POLICY.freeBeforeHours),
  lateFeePercent: String(DEFAULT_POLICY.lateFeePercent),
  lateWindowHours: String(DEFAULT_POLICY.lateWindowHours),
  graceMinutesAfterAccept: String(DEFAULT_POLICY.graceMinutesAfterAccept),
  payoutDelayHours: "24",           // versement N h après la fin de la prestation
  scheduledResponseHours: "12",     // délai de réponse du barbier pour une réservation planifiée
  minLeadMinutes: "60",
  supportEmail: "[À RENSEIGNER]",
  companyName: "[À RENSEIGNER – raison sociale]",
} as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const rows = await db.setting.findMany();
  const out: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in out) out[r.key] = r.value;
  return out as Record<SettingKey, string>;
}
export const toPolicy = (s: Record<SettingKey, string>): CancelPolicy => ({
  freeBeforeHours: Number(s.freeBeforeHours), lateFeePercent: Number(s.lateFeePercent),
  lateWindowHours: Number(s.lateWindowHours), graceMinutesAfterAccept: Number(s.graceMinutesAfterAccept),
});
