// Calcul des créneaux libres d'un barbier (fuseau Europe/Zurich), temps de trajet inclus.
import { DateTime } from "luxon";
export const TZ = "Europe/Zurich";

export type Rule = { weekday: number; startMin: number; endMin: number };
export type Interval = { start: Date; end: Date };
export type SlotInput = {
  rules: Rule[]; timeOff: Interval[]; booked: Interval[];
  durationMin: number; travelBufferMin: number;
  from: Date; days: number; now: Date; leadMin?: number; stepMin?: number;
};

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/** Un rendez-vous occupe [début − trajet, fin + trajet] ; un nouveau créneau ne doit chevaucher ni cela, ni un congé. */
export function freeSlots(inp: SlotInput): Date[] {
  const step = inp.stepMin ?? 30, lead = inp.leadMin ?? 60, buf = inp.travelBufferMin * 60_000, dur = inp.durationMin * 60_000;
  const earliest = inp.now.getTime() + lead * 60_000;
  const busy = [
    ...inp.booked.map((b) => [b.start.getTime() - buf, b.end.getTime() + buf] as const),
    ...inp.timeOff.map((t) => [t.start.getTime(), t.end.getTime()] as const),
  ];
  const out: Date[] = [];
  const day0 = DateTime.fromJSDate(inp.from, { zone: TZ }).startOf("day");
  for (let d = 0; d < inp.days; d++) {
    const day = day0.plus({ days: d });
    for (const r of inp.rules.filter((x) => x.weekday === day.weekday)) {
      for (let m = r.startMin; m + inp.durationMin <= r.endMin; m += step) {
        const s = day.plus({ minutes: m }).toMillis(), e = s + dur;
        if (s < earliest) continue;
        if (busy.some(([b0, b1]) => overlaps(s, e, b0, b1))) continue;
        out.push(new Date(s));
      }
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

/** Vrai si [start, end] (avec trajets) est compatible avec le planning — utilisé pour la revérification transactionnelle. */
export function isSlotFree(start: Date, end: Date, booked: Interval[], timeOff: Interval[], travelBufferMin: number) {
  const buf = travelBufferMin * 60_000;
  return !booked.some((b) => overlaps(start.getTime(), end.getTime(), b.start.getTime() - buf, b.end.getTime() + buf))
    && !timeOff.some((t) => overlaps(start.getTime(), end.getTime(), t.start.getTime(), t.end.getTime()));
}

export const fmtSlot = (d: Date) => DateTime.fromJSDate(d, { zone: TZ }).setLocale("fr-CH").toFormat("ccc d LLL · HH:mm");
export const fmtDateTime = (d: Date) => DateTime.fromJSDate(d, { zone: TZ }).setLocale("fr-CH").toFormat("cccc d LLLL yyyy 'à' HH:mm");
