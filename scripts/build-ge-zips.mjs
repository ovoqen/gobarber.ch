// Génère src/data/ge-zips.json : tous les couples (NPA, localité) du canton de Genève, depuis le registre officiel des adresses (geo.admin.ch).
import { writeFileSync } from "node:fs";
const found = new Map();
for (let z = 1200; z <= 1299; z++) {
  const r = await fetch(`https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&origins=address&limit=50&sr=4326&searchText=${z}%20ge`);
  const j = await r.json();
  for (const { attrs: a } of j.results ?? []) {
    if (!/ ge$/.test(a.detail.trim())) continue; // détail se termine par le code du canton
    const m = a.label.replace(/<[^>]*>/g, "").match(/\s(\d{4})\s+(.+)$/); if (!m || +m[1] !== z) continue;
    found.set(`${m[1]}|${m[2].replace(/\s+GE$/, "")}`, { zip: m[1], city: m[2].replace(/\s+GE$/, "") });
  }
}
// Compléments : NPA absents de la recherche, et libellés qui nomment aussi la commune politique (nécessaire pour la carte).
found.set('1288|', { zip: '1288', city: 'Aire-la-Ville' }); found.set('1239|', { zip: '1239', city: 'Collex-Bossy' });
for (const [k, v] of [...found]) { if (v.zip === '1257') found.set(k, { zip: '1257', city: 'La Croix-de-Rozon (Bardonnex)' }); if (v.zip === '1213') found.set(k, { zip: '1213', city: 'Onex / Petit-Lancy' }); }
const list = [...found.values()].sort((a, b) => a.zip.localeCompare(b.zip) || a.city.localeCompare(b.city));
writeFileSync(new URL("../src/data/ge-zips.json", import.meta.url), JSON.stringify(list));
console.log(list.length, "couples NPA/localité");
