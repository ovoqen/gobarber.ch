import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { requirePartner } from "@/lib/auth";
import { WEEKDAYS, toHM } from "@/lib/constants";
import { Alert, PageTitle } from "@/components/ui";
import { PNav } from "../PartnerNav";
import { saveAvailability, addTimeOff, deleteTimeOff } from "../actions";
export const metadata = { title: "Disponibilités" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const u = await requirePartner(); const sp = await searchParams; const p = u.partner;
  const [rules, off] = await Promise.all([db.availabilityRule.findMany({ where: { partnerId: p.id }, orderBy: { startMin: "asc" } }), db.timeOff.findMany({ where: { partnerId: p.id, endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } })]);
  return (
    <div className="container-x max-w-3xl py-10"><PageTitle title="Disponibilités" /><PNav current="/partenaire/disponibilites" />
      <div className="space-y-6">{sp.ok && <Alert kind="ok">{sp.ok}</Alert>}{sp.e && <Alert kind="error">{sp.e}</Alert>}
        <form action={saveAvailability} className="card space-y-4"><h2 className="text-xl font-semibold">Horaires hebdomadaires</h2><p className="text-sm text-muted">Deux plages possibles par jour (ex. 09:00–12:00 puis 14:00–19:00). Laissez vide = jour de repos.</p>
          {WEEKDAYS.slice(1).map((n, i) => { const d = i + 1, r = rules.filter((x) => x.weekday === d);
            return <div key={d} className="grid grid-cols-[6rem_1fr_1fr] items-center gap-2 text-sm sm:grid-cols-[7rem_repeat(4,1fr)]"><span className="font-medium">{n}</span>
              {(["a", "b"] as const).map((k, j) => <span key={k} className="contents"><input aria-label={`${n} début ${j + 1}`} type="time" name={`${k}s${d}`} defaultValue={r[j] ? toHM(r[j].startMin) : ""} className="field !min-h-9 !py-1" /><input aria-label={`${n} fin ${j + 1}`} type="time" name={`${k}e${d}`} defaultValue={r[j] ? toHM(r[j].endMin) : ""} className="field !min-h-9 !py-1" /></span>)}</div>; })}
          <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2"><div><label className="lbl" htmlFor="tb">Temps de trajet entre rendez-vous (min)</label><input id="tb" name="travelBufferMin" type="number" min={5} max={90} defaultValue={p.travelBufferMin} className="field" /><p className="mt-1 text-xs text-muted">Bloqué avant et après chaque rendez-vous pour éviter les retards.</p></div>
            <div><label className="lbl" htmlFor="rw">Délai de réponse aux demandes immédiates (min)</label><input id="rw" name="responseWindowMin" type="number" min={5} max={120} defaultValue={p.responseWindowMin} className="field" /></div></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="instant" defaultChecked={p.instantEnabled} className="size-5" />Accepter les demandes « dès que possible »</label><button className="btn-dark">Enregistrer</button></form>
        <section className="card space-y-3"><h2 className="text-xl font-semibold">Congés et indisponibilités</h2>
          <ul className="space-y-1 text-sm">{off.map((o) => <li key={o.id} className="flex items-center justify-between"><span>{DateTime.fromJSDate(o.startsAt, { zone: "Europe/Zurich" }).toFormat("dd.LL.yyyy")} → {DateTime.fromJSDate(o.endsAt, { zone: "Europe/Zurich" }).toFormat("dd.LL.yyyy")} {o.reason && `· ${o.reason}`}</span><form action={deleteTimeOff}><input type="hidden" name="id" value={o.id} /><button className="text-bad underline">Retirer</button></form></li>)}{!off.length && <li className="text-muted">Aucun congé planifié.</li>}</ul>
          <form action={addTimeOff} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-4"><div><label className="lbl" htmlFor="from">Du</label><input id="from" type="date" name="from" required className="field" /></div><div><label className="lbl" htmlFor="to">Au</label><input id="to" type="date" name="to" required className="field" /></div><div className="sm:col-span-2"><label className="lbl" htmlFor="reason">Motif (facultatif)</label><input id="reason" name="reason" className="field" /></div><button className="btn-ghost sm:col-span-4">Ajouter</button></form></section></div></div>
  );
}
