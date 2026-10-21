// Génère src/data/ge-communes.json : contours officiels (swisstopo swissBOUNDARIES3D) des 45 communes genevoises, projetés en km.
// Usage : node scripts/build-ge-map.mjs   (nécessite internet)
import { readFileSync, writeFileSync } from "node:fs";
const NAMES = JSON.parse(readFileSync(new URL("./ge-names.json", import.meta.url), "utf8")); // [[bfs, nom], …]
const LON0 = 6.12, LAT0 = 46.2, KX = 111.32 * Math.cos((LAT0 * Math.PI) / 180), KY = 110.57;
const proj = ([lo, la]) => [(lo - LON0) * KX, (la - LAT0) * KY];
function dp(p, tol) { // Douglas-Peucker sur une polyligne ouverte
  if (p.length < 3) return p; const keep = new Uint8Array(p.length); keep[0] = keep[p.length - 1] = 1; const st = [[0, p.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let m = 0, mi = -1; const [x1, y1] = p[a], [x2, y2] = p[b], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * p[i][0] - dx * p[i][1] + x2 * y1 - y2 * x1) / L; if (d > m) { m = d; mi = i; } }
    if (m > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return p.filter((_, i) => keep[i]);
}
const simplifyRing = (r) => { const h = r.length >> 1; return [...dp(r.slice(0, h + 1), 0.02).slice(0, -1), ...dp(r.slice(h), 0.02)]; }; // anneau fermé → deux moitiés
const out = [];
for (const [id, name] of NAMES) {
  const j = await (await fetch(`https://api3.geo.admin.ch/rest/services/api/MapServer/ch.swisstopo.swissboundaries3d-gemeinde-flaeche.fill/${id}?geometryFormat=geojson&sr=4326`)).json();
  const g = j.feature.geometry; const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const rings = polys.map((rs) => rs.map((r) => simplifyRing(r.map(proj)).map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)])));
  let sx = 0, sy = 0, n = 0; for (const p of rings) for (const [x, y] of p[0]) { sx += x; sy += y; n++; }
  out.push({ id, name, cx: +(sx / n).toFixed(3), cy: +(sy / n).toFixed(3), polys: rings });
}
writeFileSync(new URL("../src/data/ge-communes.json", import.meta.url), JSON.stringify(out));
console.log(out.length, "communes", (JSON.stringify(out).length / 1024).toFixed(0), "Ko");
