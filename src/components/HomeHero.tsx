"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import HeroSearch from "./HeroSearch";
const Carte = dynamic(() => import("./CarteGeneve3D"), { ssr: false, loading: () => null });

const WHEN = [["asap", "Dès que possible", "Un barbier libre maintenant"], ["tonight", "Ce soir", "Créneaux d'aujourd'hui"], ["tomorrow", "Demain", "Créneaux de demain"], ["pick", "Choisir", "Jour et heure au choix"]] as const;

export default function HomeHero({ counts }: { counts: Record<string, number> }) {
  const [when, setWhen] = useState<string>("asap");
  const w = when === "pick" ? "" : when;
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
      <div className="text-left">
        <p className="eyebrow mb-8">Le barbier vient chez vous</p>
        <h1 className="text-5xl leading-[1.08] sm:text-6xl lg:text-7xl">Votre barbier<br /><span className="italic text-gold">à domicile</span> à Genève.</h1>
        <p className="mt-8 max-w-md text-lg leading-8 text-white/70 sm:text-xl sm:leading-9">Pas de salon, pas d'attente : un barbier professionnel se déplace chez vous, au jour et à l'heure de votre choix.</p>
        <ul className="mt-9 flex flex-wrap gap-3 text-[15px] text-white/85">
          {[["M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", "Il vient chez vous"], ["M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8.1 8.1 20 20M8.1 15.9 20 4", "Coupe, barbe, enfant"], ["M12 6v6l4 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "Réservé en 1 minute"]].map(([d, l]) => (
            <li key={l} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[.04] px-4 py-2.5"><svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-none stroke-gold" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>{l}</li>
          ))}
        </ul>
        <fieldset className="mt-14">
          <legend className="mb-4 text-base text-white/70">Pour quand ?</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-4">
            {WHEN.map(([id, label, sub]) => (
              <button key={id} type="button" role="radio" aria-checked={when === id} onClick={() => setWhen(id)}
                className={`min-h-[4.75rem] rounded-2xl border px-5 py-4 text-left transition duration-300 ${when === id ? "border-gold bg-gold/15" : "border-white/15 bg-white/[.04] hover:border-white/40"}`}>
                <span className={`block font-display text-2xl ${when === id ? "text-gold" : "text-white"}`}>{label}</span><span className="mt-0.5 block text-[13px] text-white/55">{sub}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="relative z-20 [&>form]:mt-10"><HeroSearch when={w} /></div>
        <p className="mt-4 text-sm text-white/55">…ou touchez votre commune sur la carte.</p>
        <p className="mt-10 border-t border-white/10 pt-6 text-base text-white/65">Première fois ? <a href="/inscription" className="text-gold underline underline-offset-4">Créer mon profil</a> · <a href="/connexion" className="underline underline-offset-4">J'ai déjà un compte</a></p>
      </div>
      <div className="relative">
        <div className="[mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_88%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_88%,transparent_100%)]"><Carte counts={counts} onPick={(name) => window.location.assign(`/reserver?q=${encodeURIComponent(name)}${w ? `&when=${w}` : ""}`)} /></div>
      </div>
    </div>
  );
}
