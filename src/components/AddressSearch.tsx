"use client";
import { useEffect, useRef, useState } from "react";

export type VerifiedAddress = { street: string; zip: string; city: string; lat: number | null; lon: number | null };
type Hit = { kind: "address" | "place"; label: string; street?: string; zip?: string; city?: string; lat: number; lon: number };

/** Champ d'adresse avec suggestions officielles suisses. L'adresse n'est « vérifiée » que lorsqu'une suggestion est choisie ;
 *  la saisie manuelle reste possible en secours (adresse non vérifiée, signalée comme telle). */
export function AddressSearch({ value, onChange, initialText = "" }: { value: VerifiedAddress | null; onChange: (a: VerifiedAddress | null) => void; initialText?: string }) {
  const [text, setText] = useState(initialText), [hits, setHits] = useState<Hit[]>([]), [open, setOpen] = useState(false), [active, setActive] = useState(-1), [busy, setBusy] = useState(false), [down, setDown] = useState(false);
  const [manual, setManual] = useState(false), [outside, setOutside] = useState(false), [geoMsg, setGeoMsg] = useState(""), [locating, setLocating] = useState(false);
  const seq = useRef(0), box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value || text.trim().length < 2) { setHits([]); return; }
    const id = ++seq.current; setBusy(true);
    const t = setTimeout(async () => {
      try { const r = await fetch(`/api/address?q=${encodeURIComponent(text)}`); const j = await r.json(); if (id === seq.current) { setHits(j.hits ?? []); setDown(!!j.unavailable); setOutside(!!j.outside); setActive(-1); setOpen(true); } }
      catch { if (id === seq.current) setDown(true); } finally { if (id === seq.current) setBusy(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [text, value]);
  useEffect(() => { const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);

  function pick(h: Hit) {
    if (h.kind === "address") { onChange({ street: h.street!, zip: h.zip!, city: h.city!, lat: h.lat, lon: h.lon }); setText(`${h.street}, ${h.zip} ${h.city}`); setOpen(false); }
    else { setText(`${h.zip ? h.zip + " " : ""}${h.city} `); setHits([]); setActive(-1); document.getElementById("addr-q")?.focus(); }
  }
  function key(e: React.KeyboardEvent) {
    if (!open || !hits.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % hits.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? hits.length - 1 : a - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(hits[active]); }
    else if (e.key === "Escape") setOpen(false);
  }
  /** Géolocalisation facultative : la permission n'est demandée qu'au clic ; refuser ou échouer ne bloque rien (saisie manuelle toujours possible). */
  function locate() {
    setGeoMsg(""); if (!("geolocation" in navigator)) { setGeoMsg("La localisation n'est pas disponible sur cet appareil : saisissez votre adresse."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const j = await (await fetch(`/api/address/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`)).json();
        if (j.found) { onChange({ street: j.street, zip: j.zip, city: j.city, lat: j.lat, lon: j.lon }); setText(`${j.street}, ${j.zip} ${j.city}`); }
        else setGeoMsg(j.outside ? "Votre position est hors du canton de Genève, où nous intervenons pour l'instant." : "Aucune adresse trouvée à cet endroit : saisissez-la à la main.");
      } catch { setGeoMsg("Localisation impossible pour le moment : saisissez votre adresse."); } finally { setLocating(false); }
    }, (err) => { setLocating(false); setGeoMsg(err.code === 1 ? "Localisation refusée : pas de problème, saisissez votre adresse." : "Position introuvable : saisissez votre adresse."); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }
  const gmaps = value ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${value.street}, ${value.zip} ${value.city}, Suisse`)}` : "";
  const embed = value ? `https://maps.google.com/maps?q=${encodeURIComponent(value.lat != null ? `${value.lat},${value.lon}` : `${value.street}, ${value.zip} ${value.city}`)}&z=17&output=embed&hl=fr` : "";

  return (
    <div className="space-y-3">
      <div ref={box} className="relative">
        <label htmlFor="addr-q" className="lbl">Votre adresse</label>
        <input id="addr-q" className="field pr-24" role="combobox" aria-expanded={open && hits.length > 0} aria-controls="addr-list" aria-autocomplete="list" autoComplete="off" placeholder="Commune, code postal ou rue — ex. Carouge, Lancy, Rue du Rhône 10"
          value={text} onChange={(e) => { setText(e.target.value); if (value) onChange(null); }} onFocus={() => hits.length && setOpen(true)} onKeyDown={key} />
        {value && <span className="pointer-events-none absolute right-3 top-9 rounded-full bg-ok/10 px-2 py-0.5 text-xs font-semibold text-ok">✓ vérifiée</span>}
        {busy && !value && <span className="absolute right-3 top-10 text-xs text-muted" aria-hidden>…</span>}
        {open && hits.length > 0 && !value && (
          <ul id="addr-list" role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-white py-1 shadow-xl">
            {hits.map((h, i) => (
              <li key={i} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); pick(h); }} onMouseEnter={() => setActive(i)} className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm ${i === active ? "bg-gold-100" : ""}`}>
                <span aria-hidden className="text-gold">{h.kind === "address" ? "◉" : "⌖"}</span><span>{h.label}{h.kind === "place" && <span className="text-muted"> — localité</span>}</span>
              </li>
            ))}
          </ul>
        )}
        {open && !busy && !hits.length && !value && text.trim().length >= 3 && <p className="absolute z-20 mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted shadow-xl">{down ? "Recherche d'adresses momentanément indisponible : utilisez la saisie manuelle." : outside ? "Nous intervenons pour l'instant uniquement dans le canton de Genève. Votre région sera bientôt ouverte." : "Aucune adresse trouvée dans le canton de Genève. Vérifiez l'orthographe."}</p>}
      </div>

      {value && (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <iframe title="Aperçu de l'adresse sur la carte" src={embed} className="h-48 w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span><strong>{value.street}</strong>, {value.zip} {value.city}</span><span className="flex gap-3"><a href={gmaps} target="_blank" rel="noreferrer" className="underline">Ouvrir dans Google Maps</a><button type="button" className="underline" onClick={() => { onChange(null); }}>Modifier</button></span></div>
        </div>
      )}

      {!value && <div><button type="button" onClick={locate} disabled={locating} className="btn-ghost !min-h-10">{locating ? "Localisation…" : "📍 Utiliser ma position"}</button>{geoMsg && <p role="status" className="mt-2 text-sm text-muted">{geoMsg}</p>}<p className="mt-1 text-xs text-muted">Facultatif : votre position n'est utilisée que pour trouver votre adresse, et n'est pas conservée.</p></div>}
      {!value && !manual && !outside && <button type="button" className="text-sm underline" onClick={() => setManual(true)}>Mon adresse n'apparaît pas — la saisir à la main</button>}
      {!value && manual && <ManualAddress onDone={(a) => { onChange(a); setManual(false); }} />}
    </div>
  );
}

function ManualAddress({ onDone }: { onDone: (a: VerifiedAddress) => void }) {
  const [a, setA] = useState({ street: "", zip: "", city: "" });
  const ok = a.street.trim().length >= 3 && /^[1-9]\d{3}$/.test(a.zip) && a.city.trim().length >= 2;
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-gold/60 p-3">
      <div><label className="lbl" htmlFor="m-street">Rue et numéro</label><input id="m-street" className="field" value={a.street} onChange={(e) => setA({ ...a, street: e.target.value })} /></div>
      <div className="grid grid-cols-3 gap-3"><div><label className="lbl" htmlFor="m-zip">NPA</label><input id="m-zip" className="field" inputMode="numeric" maxLength={4} value={a.zip} onChange={(e) => setA({ ...a, zip: e.target.value.replace(/\D/g, "") })} /></div><div className="col-span-2"><label className="lbl" htmlFor="m-city">Localité</label><input id="m-city" className="field" value={a.city} onChange={(e) => setA({ ...a, city: e.target.value })} /></div></div>
      <button type="button" className="btn-dark" disabled={!ok} onClick={() => onDone({ street: a.street.trim(), zip: a.zip, city: a.city.trim(), lat: null, lon: null })}>Utiliser cette adresse</button>
    </div>
  );
}
