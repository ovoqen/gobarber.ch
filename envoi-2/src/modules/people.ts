// Cohérence des prestations et nombre minimal de personnes. Règle : « Coupe + barbe » INCLUT la coupe et la barbe ;
// les prendre en plus signifie qu'une AUTRE personne en veut aussi. Les prestations hors famille (ex. coupe enfant) = une personne de plus chacune.
export const INCLUDES: Record<string, string[]> = { "coupe-barbe": ["coupe", "barbe"] };
const FAMILY = new Set(["coupe", "barbe", "coupe-barbe"]);

/** Vrai si l'une des deux prestations est comprise dans l'autre (ex. « barbe » et « coupe-barbe »). */
export const overlapsPair = (a: string, b: string) => !!INCLUDES[a]?.includes(b) || !!INCLUDES[b]?.includes(a);

export type Line = { code: string; qty: number };
export function minPeople(lines: Line[]): number {
  const q = (c: string) => lines.find((l) => l.code === c)?.qty ?? 0;
  const combos = Object.keys(INCLUDES).reduce((a, c) => a + q(c), 0);
  const covered = new Set(Object.values(INCLUDES).flat());
  const singles = [...covered].map(q);
  // avec une formule combinée : chaque personne en formule + une personne par coupe/barbe prise séparément ; sans formule : la coupe et la barbe peuvent concerner la même personne
  const fam = combos > 0 ? combos + singles.reduce((a, b) => a + b, 0) : Math.max(0, ...singles);
  const others = lines.filter((l) => !FAMILY.has(l.code)).reduce((a, l) => a + l.qty, 0);
  return Math.max(1, fam + others);
}
