"use client";
import { useEffect, useRef, useState } from "react";

type Hit = { kind: "address" | "place"; label: string };
/** Barre de recherche de l'accueil : ville, code postal ou adresse, avec suggestions ; mène à l'étape Adresse de la réservation. */
export default function HeroSearch({ when = "" }: { when?: string }) {
  const [outside, setOutside] = useState(false), [text, setText] = useState(""), [hits, setHits] = useState<Hit[]>([]), [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const seq = useRef(0), box = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (text.trim().length < 2) { setHits([]); return; }
    const id = ++seq.current;
    const t = setTimeout(async () => { try { const j = await (await fetch(`/api/address?q=${encodeURIComponent(text)}`)).json(); if (id === seq.current) { setHits(j.hits ?? []); setOutside(!!j.outside); setActive(-1); setOpen(true); } } catch {} }, 220);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => { const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const go = (q: string) => { window.location.assign(`/reserver?q=${encodeURIComponent(q.trim())}${when ? `&when=${when}` : ""}`); };
  return (
    <form ref={box} role="search" onSubmit={(e) => { e.preventDefault(); go(active >= 0 ? hits[active].label : text); }} className="relative mt-10 max-w-xl">
      <div className="flex flex-col gap-3 rounded-[28px] border border-white/15 bg-white/[.06] p-2 backdrop-blur sm:flex-row sm:rounded-full">
        <label htmlFor="hero-q" className="sr-only">Ville, code postal ou adresse</label>
        <input id="hero-q" role="combobox" aria-expanded={open && hits.length > 0} aria-controls="hero-list" aria-autocomplete="list" autoComplete="off" required value={text}
          onChange={(e) => setText(e.target.value)} onFocus={() => hits.length && setOpen(true)}
          onKeyDown={(e) => { if (!open || !hits.length) return; if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % hits.length); } else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? hits.length - 1 : a - 1)); } else if (e.key === "Escape") setOpen(false); }}
          placeholder="Commune, code postal ou adresse (Carouge, Lancy…)" className="min-h-12 flex-1 bg-transparent px-5 text-base text-white outline-none placeholder:text-white/40" />
        <button className="btn-gold">Réserver</button>
      </div>
      {open && outside && !hits.length && <p role="status" className="absolute z-30 mt-2 w-full rounded-2xl border border-white/10 bg-coal px-5 py-4 text-sm text-white/80 shadow-2xl">Nous intervenons pour l'instant uniquement dans le canton de Genève. Votre région ouvrira bientôt.</p>}
      {open && hits.length > 0 && (
        <ul id="hero-list" role="listbox" className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-white/10 bg-coal py-1 text-white shadow-2xl">
          {hits.map((h, i) => (
            <li key={i} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); go(h.label); }} onMouseEnter={() => setActive(i)} className={`flex cursor-pointer items-center gap-3 px-5 py-2.5 text-sm ${i === active ? "bg-white/10" : ""}`}>
              <span aria-hidden className="text-gold">{h.kind === "address" ? "◉" : "⌖"}</span><span>{h.label}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
