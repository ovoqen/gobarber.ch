import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Alert } from "@/components/ui";
import { ConfirmForm } from "@/components/Confirm";
import { saveSettings } from "../actions";
export const dynamic = "force-dynamic";
const LABELS: Record<string, string> = { commissionBps: "Commission (points de base : 2000 = 20 %)", freeBeforeHours: "Annulation gratuite jusqu'à (h avant)", lateFeePercent: "Frais d'annulation tardive (%)", lateWindowHours: "Frais pleins sous (h avant)", graceMinutesAfterAccept: "Annulation gratuite après acceptation (min)", payoutDelayHours: "Délai de versement après prestation (h)", scheduledResponseHours: "Délai de réponse du barbier, réservation planifiée (h)", minLeadMinutes: "Préavis minimal de réservation (min)", supportEmail: "E-mail de l'assistance", companyName: "Raison sociale (reçus)" };
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  await requireStaff("settings.manage"); const sp = await searchParams; const s = await getSettings();
  return <div className="max-w-2xl space-y-4"><h1 className="text-3xl font-semibold">Paramètres</h1><Alert>Valeurs par défaut = <strong>hypothèses</strong> à valider (commission, politique d'annulation). Les réservations existantes conservent la commission appliquée à leur création.</Alert>{sp.ok && <Alert kind="ok">{sp.ok}</Alert>}{sp.e && <Alert kind="error">{sp.e}</Alert>}
    <ConfirmForm action={saveSettings} message="Enregistrer ces paramètres ? Ils s'appliquent aux nouvelles réservations." className="card space-y-3">{Object.entries(LABELS).map(([k, l]) => <div key={k}><label htmlFor={k} className="lbl">{l}</label><input id={k} name={k} defaultValue={s[k as keyof typeof s]} className="field" /></div>)}<button className="btn-dark">Enregistrer</button></ConfirmForm></div>;
}
