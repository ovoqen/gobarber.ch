import Link from "next/link";
import { DateTime } from "luxon";
import { TZ } from "@/modules/slots";

export type CalEvent = { id: string; start: Date; end: Date; title: string; sub?: string; status: string; href: string };
export type CalOff = { start: Date; end: Date };
export type CalRule = { weekday: number; startMin: number; endMin: number };

const H0 = 7, H1 = 21, ROW = 52; // heures affichées et hauteur d'une heure (px)
const STYLE: Record<string, { box: string; label: string }> = {
  REQUESTED: { box: "border-dashed border-gold bg-gold/10 text-white", label: "À répondre" },
  ACCEPTED: { box: "border-gold bg-gold/25 text-white", label: "Confirmé" },
  EN_ROUTE: { box: "border-gold bg-gold/40 text-white", label: "En route" },
  IN_PROGRESS: { box: "border-gold bg-gold/55 text-white", label: "En cours" },
  COMPLETED: { box: "border-ok/60 bg-ok/20 text-white", label: "Terminé" },
  CANCELLED: { box: "border-bad/70 border-dashed bg-bad/10 text-white/70 line-through decoration-bad/60", label: "Annulé" },
  NO_SHOW_CLIENT: { box: "border-bad/60 bg-bad/20 text-white", label: "Client absent" },
};
const hm = (d: Date) => DateTime.fromJSDate(d, { zone: TZ }).toFormat("HH:mm");

/** Calendrier hebdomadaire : grille sur ordinateur, liste par jour sur téléphone. Rendu serveur, navigation par liens (?s=AAAA-MM-JJ). */
export function CalendarWeek({ weekStart, events, offs = [], rules = [], baseHref, extraQuery = "", newHref }: { weekStart: DateTime; events: CalEvent[]; offs?: CalOff[]; rules?: CalRule[]; baseHref: string; extraQuery?: string; newHref?: string }) {
  const days = Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }));
  const now = DateTime.now().setZone(TZ), today = now.startOf("day");
  const link = (d: DateTime) => `${baseHref}?s=${d.toISODate()}${extraQuery}`;
  const thisWeek = today.startOf("week");
  const onDay = (d: DateTime) => events.filter((e) => DateTime.fromJSDate(e.start, { zone: TZ }).hasSame(d, "day")).sort((a, b) => a.start.getTime() - b.start.getTime());
  const pos = (d: Date, day: DateTime) => { const m = DateTime.fromJSDate(d, { zone: TZ }).diff(day.startOf("day"), "minutes").minutes; return Math.max(0, ((m / 60) - H0) * ROW); };
  const gridH = (H1 - H0) * ROW;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={link(weekStart.minus({ weeks: 1 }))} aria-label="Semaine précédente" className="btn-ghost !min-h-10 !px-4">←</Link>
          <Link href={link(thisWeek)} className="btn-ghost !min-h-10">Aujourd'hui</Link>
          <Link href={link(weekStart.plus({ weeks: 1 }))} aria-label="Semaine suivante" className="btn-ghost !min-h-10 !px-4">→</Link>
        </div>
        {newHref && <Link href={newHref} className="btn-gold !min-h-10">+ Nouveau rendez-vous</Link>}
        <h2 className="font-display text-2xl capitalize">{weekStart.setLocale("fr-CH").toFormat("d LLLL")} – {weekStart.plus({ days: 6 }).setLocale("fr-CH").toFormat("d LLLL yyyy")}</h2>
      </div>

      {/* Ordinateur : grille */}
      <div className="card hidden overflow-hidden !p-0 md:block">
        <div className="grid grid-cols-[3.2rem_repeat(7,1fr)] border-b border-white/10 text-center text-sm">
          <div />
          {days.map((d) => <div key={d.toISODate()} className={`py-2.5 ${d.hasSame(today, "day") ? "bg-gold/15 text-gold" : "text-muted"}`}><span className="block text-[11px] uppercase tracking-widest">{d.setLocale("fr-CH").toFormat("ccc")}</span><span className="font-display text-2xl text-white">{d.day}</span></div>)}
        </div>
        <div className="relative grid grid-cols-[3.2rem_repeat(7,1fr)]" style={{ height: gridH }}>
          <div className="relative">{Array.from({ length: H1 - H0 }, (_, i) => <span key={i} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted" style={{ top: i * ROW }}>{i ? `${H0 + i}h` : ""}</span>)}</div>
          {days.map((d) => (
            <div key={d.toISODate()} className="relative border-l border-white/10">
              {Array.from({ length: H1 - H0 }, (_, i) => <div key={i} className="absolute inset-x-0 border-t border-white/[.06]" style={{ top: i * ROW }} />)}
              {rules.filter((r) => r.weekday === d.weekday).map((r, i) => <div key={i} aria-hidden className="absolute inset-x-0 bg-white/[.045]" style={{ top: Math.max(0, (r.startMin / 60 - H0) * ROW), height: ((Math.min(r.endMin, H1 * 60) - Math.max(r.startMin, H0 * 60)) / 60) * ROW }} />)}
              {offs.filter((o) => o.end > d.startOf("day").toJSDate() && o.start < d.endOf("day").toJSDate()).map((o, i) => <div key={i} className="absolute inset-x-0 top-0 flex items-start justify-center bg-[repeating-linear-gradient(135deg,rgba(255,255,255,.07)_0_6px,transparent_6px_12px)] pt-2 text-[11px] text-muted" style={{ height: gridH }}>Congé</div>)}
              {d.hasSame(now, "day") && now.hour >= H0 && now.hour < H1 && <div aria-hidden className="absolute inset-x-0 z-10 border-t-2 border-bad" style={{ top: pos(now.toJSDate(), d) }}><span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-bad" /></div>}
              {onDay(d).map((e) => { const s = STYLE[e.status] ?? STYLE.ACCEPTED, top = pos(e.start, d), h = Math.max(30, ((e.end.getTime() - e.start.getTime()) / 3_600_000) * ROW - 2);
                return <Link key={e.id} href={e.href} title={`${hm(e.start)}–${hm(e.end)} · ${e.title} · ${s.label}`} className={`absolute inset-x-1 z-[5] overflow-hidden rounded-lg border-l-4 px-2 py-1 text-xs leading-tight transition hover:brightness-125 focus-visible:z-20 ${s.box}`} style={{ top: top + 1, height: h }}>
                  <strong className="block truncate">{hm(e.start)} {e.title}</strong>{h > 44 && <span className="block truncate opacity-75">{e.sub ?? s.label}</span>}</Link>; })}
            </div>
          ))}
        </div>
      </div>

      {/* Téléphone : liste par jour */}
      <div className="space-y-3 md:hidden">
        {days.map((d) => { const list = onDay(d); return (
          <section key={d.toISODate()} className={`card !p-4 ${d.hasSame(today, "day") ? "!border-gold/60" : ""}`}>
            <h3 className="mb-2 flex items-baseline justify-between text-lg capitalize"><span>{d.setLocale("fr-CH").toFormat("cccc d LLLL")}</span>{d.hasSame(today, "day") && <span className="text-xs font-semibold uppercase tracking-widest text-gold">Aujourd'hui</span>}</h3>
            {list.length === 0 ? <p className="text-sm text-muted">Rien de prévu.</p> : <ul className="space-y-2">{list.map((e) => { const s = STYLE[e.status] ?? STYLE.ACCEPTED; return <li key={e.id}><Link href={e.href} className={`block rounded-xl border-l-4 px-3 py-2.5 ${s.box}`}><span className="flex justify-between gap-2"><strong>{hm(e.start)}–{hm(e.end)}</strong><span className="text-xs opacity-80">{s.label}</span></span><span className="block text-sm opacity-90">{e.title}{e.sub ? ` · ${e.sub}` : ""}</span></Link></li>; })}</ul>}
          </section>); })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted" aria-label="Légende">
        {[["REQUESTED", "À répondre"], ["ACCEPTED", "Confirmé"], ["IN_PROGRESS", "En cours"], ["COMPLETED", "Terminé"], ["CANCELLED", "Annulé"]].map(([k, l]) => <li key={k} className="flex items-center gap-2"><span className={`inline-block h-3 w-5 rounded border-l-4 ${STYLE[k].box}`} />{l}</li>)}
        <li className="flex items-center gap-2"><span className="inline-block h-3 w-5 rounded bg-white/[.1]" />Vos heures d'ouverture</li>
      </ul>
    </div>
  );
}

export const weekStartFrom = (s?: string) => { const d = s ? DateTime.fromISO(s, { zone: TZ }) : DateTime.now().setZone(TZ); return (d.isValid ? d : DateTime.now().setZone(TZ)).startOf("week"); };
