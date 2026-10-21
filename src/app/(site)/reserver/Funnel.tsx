"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AddressSearch, type VerifiedAddress } from "@/components/AddressSearch";
import { INCLUDES, minPeople, overlapsPair } from "@/modules/people";

type Svc = { code: string; id: string; name: string; description: string; priceCents: number; durationMin: number };
type Addr = { id: string; label: string; street: string; zip: string; city: string; access: string | null };
type P = { id: string; name: string; bio: string; ratingAvg: number; ratingCount: number; durationMin: number; subtotalCents: number; travelFeeCents: number; totalCents: number; nextSlot: string | null; asapSlot: string | null; slots: string[]; onlinePayment: boolean };
const chf = (c: number) => `CHF ${(c / 100).toFixed(2)}`;
const fmt = (iso: string) => new Date(iso).toLocaleString("fr-CH", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
const hm = (iso: string) => new Date(iso).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
const STEPS = ["Adresse", "Prestation", "Barbier & créneau", "Récapitulatif"];

export function Funnel({ services, initialQuery, initialServiceId, initialWhen, loggedIn, addresses, policy }: { services: Svc[]; initialQuery: string; initialServiceId: string; initialWhen: string; loggedIn: boolean; addresses: Addr[]; policy: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [addr, setAddr] = useState({ street: "", zip: "", city: "", access: "", lat: null as number | null, lon: null as number | null });
  const verified: VerifiedAddress | null = addr.street && addr.city && /^[1-9]\d{3}$/.test(addr.zip) ? { street: addr.street, zip: addr.zip, city: addr.city, lat: addr.lat, lon: addr.lon } : null;
  const setVerified = (v: VerifiedAddress | null) => setAddr(v ? { ...addr, street: v.street, zip: v.zip, city: v.city, lat: v.lat, lon: v.lon } : { ...addr, street: "", zip: "", city: "", lat: null, lon: null });
  const [sel, setSel] = useState<string[]>(initialServiceId ? [initialServiceId] : []);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [people, setPeople] = useState(1);
  const q = (id: string) => qty[id] ?? 1;
  const minP = minPeople(sel.map((id) => ({ code: services.find((x) => x.id === id)!.code, qty: q(id) }))), nPeople = Math.max(people, minP);
  const codeOf = (id: string) => services.find((x) => x.id === id)!.code, nameOf = (id: string) => services.find((x) => x.id === id)!.name;
  const [ask, setAsk] = useState<{ id: string; other: string } | null>(null);
  function toggle(id: string) {
    if (sel.includes(id)) { setSel(sel.filter((x) => x !== id)); return; }
    const other = sel.find((o) => overlapsPair(codeOf(id), codeOf(o)));
    if (other) { setAsk({ id, other }); return; }
    setSel([...sel, id]);
  }
  const setQ = (id: string, n: number) => setQty((o) => ({ ...o, [id]: Math.min(6, Math.max(1, n)) }));
  const [mode, setMode] = useState<"asap" | "scheduled">(initialWhen === "asap" ? "asap" : "scheduled");
  const [date, setDate] = useState(() => new Date(Date.now() + (initialWhen === "tonight" ? 0 : 86_400_000)).toISOString().slice(0, 10));
  const [res, setRes] = useState<{ partners: P[]; fallback: P[]; noPartnerInZone: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [choice, setChoice] = useState<{ p: P; at: string } | null>(null);
  const [promo, setPromo] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { try { const s = sessionStorage.getItem("gb-funnel"); if (s) { const j = JSON.parse(s); setAddr(j.addr); setSel(j.sel); setQty(j.qty ?? {}); setPeople(j.people ?? 1); setMode(j.mode); setDate(j.date); setChoice(j.choice); setPromo(j.promo ?? ""); if (j.choice) setStep(3); sessionStorage.removeItem("gb-funnel"); } } catch {} }, []);

  const zipOk = /^[1-9]\d{3}$/.test(addr.zip);
  const addrOk = zipOk && addr.street.trim().length >= 3 && addr.city.trim().length >= 2;
  const dur = useMemo(() => services.filter((s) => sel.includes(s.id)).reduce((a, s) => a + s.durationMin * q(s.id), 0), [sel, services, qty]); // eslint-disable-line react-hooks/exhaustive-deps

  async function search() {
    setLoading(true); setErr(""); setChoice(null);
    try {
      const r = await fetch(`/api/search?zip=${addr.zip}&services=${sel.map((id) => `${id}:${q(id)}`).join(",")}&mode=${mode}&date=${date}`); const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur"); setRes(j);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { if (step === 2 && addrOk && sel.length) void search(); /* eslint-disable-next-line */ }, [step, mode, date, qty]);

  async function go() {
    if (!choice) return; setErr("");
    if (!loggedIn) { sessionStorage.setItem("gb-funnel", JSON.stringify({ addr, sel, qty, people: nPeople, mode, date, choice, promo })); window.location.assign("/connexion?next=/reserver"); return; }
    setLoading(true);
    const r = await fetch("/api/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partnerId: choice.p.id, serviceIds: sel, quantities: Object.fromEntries(sel.map((id) => [id, q(id)])), people: nPeople, mode: mode === "asap" ? "ASAP" : "SCHEDULED", startsAt: mode === "asap" ? undefined : choice.at, address: { street: addr.street, zip: addr.zip, city: addr.city, access: addr.access || null, lat: addr.lat, lng: addr.lon }, promoCode: promo || null }) });
    const j = await r.json(); setLoading(false);
    if (!r.ok) { setErr(j.error ?? "Erreur"); if (r.status === 409) { setChoice(null); setStep(2); } return; }
    window.location.assign(`/compte/reservations/${j.id}`);
  }

  return (
    <div>
      <ol className="mb-8 flex gap-2 text-xs sm:text-sm" aria-label="Étapes">
        {STEPS.map((s, i) => <li key={s} aria-current={i === step ? "step" : undefined} className={`flex-1 rounded-full px-2 py-1.5 text-center font-medium ${i === step ? "bg-ink text-white" : i < step ? "bg-gold-100 text-ink" : "bg-white text-muted border border-line"}`}>{i + 1}. {s}</li>)}
      </ol>
      {err && <p role="alert" className="mb-4 rounded-lg border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">{err}</p>}

      {step === 0 && (
        <section className="card space-y-4">
          <h1 className="text-2xl font-semibold">Où doit venir le barbier ?</h1>
          {addresses.length > 0 && <div><label className="lbl" htmlFor="saved">Adresses enregistrées</label><select id="saved" className="field" defaultValue="" onChange={(e) => { const a = addresses.find((x) => x.id === e.target.value); if (a) setAddr({ street: a.street, zip: a.zip, city: a.city, access: a.access ?? "", lat: null, lon: null }); }}><option value="">— Choisir —</option>{addresses.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.street}, {a.zip} {a.city}</option>)}</select></div>}
          <AddressSearch value={verified} onChange={setVerified} initialText={initialQuery} />
          <div><label className="lbl" htmlFor="access">Étage, digicode, indications (facultatif)</label><input id="access" className="field" value={addr.access} onChange={(e) => setAddr({ ...addr, access: e.target.value })} /><p className="mt-1 text-xs text-muted">Visible uniquement par le barbier de votre rendez-vous, une fois celui-ci accepté.</p></div>
          <button className="btn-dark w-full sm:w-auto" disabled={!addrOk} onClick={() => setStep(1)}>Continuer</button>
        </section>
      )}

      {step === 1 && (
        <section className="card space-y-4">
          <h1 className="text-2xl font-semibold">Quelle prestation ?</h1>
          {ask && (() => {
            const newIsCombo = !!INCLUDES[codeOf(ask.id)]?.includes(codeOf(ask.other));
            return (
              <div role="alertdialog" aria-label="Même personne ou une autre ?" className="rounded-xl border border-gold bg-gold-100 p-4">
                <p className="font-semibold">{newIsCombo ? `« ${nameOf(ask.id)} » comprend déjà « ${nameOf(ask.other)} ».` : `« ${nameOf(ask.other)} » comprend déjà « ${nameOf(ask.id)} ».`}</p>
                <p className="mb-3 text-sm">{newIsCombo ? "Est-ce pour la même personne, ou une autre personne veut aussi la formule ?" : "Voulez-vous « " + nameOf(ask.id) + " » en plus, pour une autre personne qui vient avec vous ?"}</p>
                <div className="flex flex-wrap gap-2">
                  {newIsCombo && <button type="button" className="btn-dark" onClick={() => { setSel([...sel.filter((x) => x !== ask.other), ask.id]); setAsk(null); }}>Même personne : remplacer</button>}
                  <button type="button" className={newIsCombo ? "btn-ghost" : "btn-dark"} onClick={() => { setSel([...sel, ask.id]); setAsk(null); }}>{newIsCombo ? "Une autre personne" : "Oui, pour une autre personne"}</button>
                  {!newIsCombo && <button type="button" className="btn-ghost" onClick={() => setAsk(null)}>Non, garder comme avant</button>}
                  {newIsCombo && <button type="button" className="btn-ghost" onClick={() => setAsk(null)}>Annuler</button>}
                </div>
              </div>);
          })()}
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.id} className={`rounded-xl border p-4 ${sel.includes(s.id) ? "border-gold bg-gold-100" : "border-line"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex flex-1 cursor-pointer items-center gap-3">
                    <input type="checkbox" aria-label={s.name} className="size-5" checked={sel.includes(s.id)} onChange={() => toggle(s.id)} />
                    <span className="flex-1"><span className="font-semibold">{s.name}</span><span className="block text-sm text-muted">{s.description} · {s.durationMin} min</span></span><span className="text-sm font-medium">dès {chf(s.priceCents)}</span>
                  </label>
                  {sel.includes(s.id) && (
                    <div role="group" aria-label={`Nombre de ${s.name}`} className="flex items-center gap-1 rounded-full border border-line bg-white p-1">
                      <button type="button" aria-label="Moins" disabled={q(s.id) <= 1} onClick={() => setQ(s.id, q(s.id) - 1)} className="grid size-10 place-items-center rounded-full text-xl hover:bg-gold-100 disabled:opacity-30">−</button>
                      <span className="w-14 text-center text-sm font-semibold" aria-live="polite">{q(s.id)} fois</span>
                      <button type="button" aria-label="Plus" disabled={q(s.id) >= 6} onClick={() => setQ(s.id, q(s.id) + 1)} className="grid size-10 place-items-center rounded-full text-xl hover:bg-gold-100 disabled:opacity-30">+</button>
                    </div>)}
                </div>
              </li>
            ))}
          </ul>
          {sel.length > 0 && (
            <div className="rounded-xl border border-gold/50 bg-gold-100 p-4">
              <p className="font-semibold">Combien de personnes seront coiffées ?</p>
              <p className="mb-3 text-sm text-muted">Le barbier doit le savoir pour prévoir le temps et le matériel. Exemple : 2 coupes + 1 coupe enfant = 3 personnes.</p>
              <div role="group" aria-label="Nombre de personnes" className="inline-flex items-center gap-1 rounded-full border border-line bg-white p-1">
                <button type="button" aria-label="Moins de personnes" disabled={nPeople <= minP} onClick={() => setPeople(nPeople - 1)} className="grid size-11 place-items-center rounded-full text-xl hover:bg-gold-100 disabled:opacity-30">−</button>
                <span className="w-28 text-center font-semibold" aria-live="polite">{nPeople} personne{nPeople > 1 ? "s" : ""}</span>
                <button type="button" aria-label="Plus de personnes" disabled={nPeople >= 8} onClick={() => setPeople(nPeople + 1)} className="grid size-11 place-items-center rounded-full text-xl hover:bg-gold-100 disabled:opacity-30">+</button>
              </div>
              {dur > 0 && <p className="mt-3 text-sm">Durée estimée : <strong>{dur} min</strong></p>}
            </div>)}
          <p className="text-xs text-muted">Le prix exact dépend du barbier choisi à l'étape suivante.</p>
          <div className="flex gap-3"><button className="btn-ghost" onClick={() => setStep(0)}>Retour</button><button className="btn-dark" disabled={!sel.length} onClick={() => setStep(2)}>Continuer</button></div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <div className="card space-y-3">
            <h1 className="text-2xl font-semibold">Quand et avec qui ?</h1>
            <div role="radiogroup" aria-label="Quand" className="grid grid-cols-2 gap-2">
              {([["asap", "Dès que possible"], ["scheduled", "Choisir un créneau"]] as const).map(([v, l]) => <button key={v} role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className={`rounded-xl border p-3 text-sm font-semibold ${mode === v ? "border-gold bg-gold-100" : "border-line bg-white"}`}>{l}</button>)}
            </div>
            {mode === "scheduled" && <div><label className="lbl" htmlFor="date">Date</label><input id="date" type="date" className="field" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></div>}
          </div>
          {loading && <p className="text-muted" role="status">Recherche des barbiers disponibles…</p>}
          {res?.noPartnerInZone && <p className="card">Aucun barbier n'intervient encore au NPA {addr.zip}. Essayez un NPA voisin ou revenez bientôt.</p>}
          {res && !res.noPartnerInZone && !res.partners.length && mode === "asap" && <p className="card">Aucun barbier n'est disponible immédiatement. {res.fallback.length ? "Voici le prochain créneau possible :" : "Aucun créneau à venir pour l'instant."}</p>}
          {[...(res?.partners ?? []), ...(mode === "asap" ? res?.fallback ?? [] : [])].map((p) => {
            const isFallback = mode === "asap" && !res?.partners.some((x) => x.id === p.id);
            const slots = mode === "scheduled" ? p.slots : [isFallback ? p.nextSlot! : p.asapSlot!];
            return (
              <article key={p.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{p.name}</h2><p className="text-sm text-muted">{p.ratingCount ? `★ ${p.ratingAvg.toFixed(1)} (${p.ratingCount} avis)` : "Pas encore d'avis"} · {p.durationMin} min</p>{p.bio && <p className="mt-1 text-sm">{p.bio}</p>}</div>
                  <div className="text-right"><p className="font-semibold">{chf(p.totalCents)}</p><p className="text-xs text-muted">dont déplacement {chf(p.travelFeeCents)}</p></div></div>
                {slots.length === 0 || !slots[0] ? <p className="text-sm text-muted">Aucun créneau ce jour-là.{p.nextSlot && <> Prochain : <button className="underline" onClick={() => { setMode("scheduled"); setDate(p.nextSlot!.slice(0, 10)); }}>{fmt(p.nextSlot)}</button></>}</p> :
                  <div className="flex flex-wrap gap-2">{slots.map((s) => <button key={s} aria-pressed={choice?.p.id === p.id && choice.at === s} onClick={() => { setChoice({ p, at: s }); }} className={`rounded-lg border px-3 py-2 text-sm font-medium ${choice?.p.id === p.id && choice.at === s ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-gold"}`}>{mode === "scheduled" ? hm(s) : `${fmt(s)}`}</button>)}</div>}
              </article>
            );
          })}
          <div className="flex gap-3"><button className="btn-ghost" onClick={() => setStep(1)}>Retour</button><button className="btn-dark" disabled={!choice} onClick={() => setStep(3)}>Continuer</button></div>
        </section>
      )}

      {step === 3 && choice && (
        <section className="card space-y-4">
          <h1 className="text-2xl font-semibold">Récapitulatif</h1>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt>Barbier</dt><dd className="font-medium">{choice.p.name}</dd></div>
            <div className="flex justify-between"><dt>Paiement</dt><dd className="font-medium">{choice.p.onlinePayment ? "En ligne (carte, Apple Pay, Google Pay, TWINT)" : "Sur place, au barbier"}</dd></div>
            <div className="flex justify-between"><dt>Personnes</dt><dd className="font-medium">{nPeople}</dd></div>
            <div className="flex justify-between"><dt>Détail</dt><dd className="text-right font-medium">{services.filter((x) => sel.includes(x.id)).map((x) => `${q(x.id)} × ${x.name}`).join(" · ")}</dd></div>
            <div className="flex justify-between"><dt>Date</dt><dd className="font-medium">{fmt(choice.at)}{mode === "asap" && " (estimation)"}</dd></div>
            <div className="flex justify-between"><dt>Adresse</dt><dd className="text-right font-medium">{addr.street}, {addr.zip} {addr.city}</dd></div>
            <div className="flex justify-between"><dt>Prestations ({dur} min)</dt><dd>{chf(choice.p.subtotalCents)}</dd></div>
            <div className="flex justify-between"><dt>Frais de déplacement</dt><dd>{chf(choice.p.travelFeeCents)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{chf(choice.p.totalCents)}</dd></div>
          </dl>
          <div><label className="lbl" htmlFor="promo">Code promotionnel (facultatif)</label><input id="promo" className="field uppercase" value={promo} onChange={(e) => setPromo(e.target.value)} /><p className="mt-1 text-xs text-muted">La remise est appliquée aux prestations et affichée avant le paiement.</p></div>
          <p className="rounded-lg bg-gold-100 p-3 text-sm"><strong>Conditions d'annulation.</strong> {policy} <a href="/legal/annulation" className="underline">Détails</a>. {choice.p.onlinePayment ? "Votre moyen de paiement n'est débité qu'à l'acceptation du barbier." : "Ce barbier est réglé sur place : aucun paiement en ligne."}</p>
          <div className="flex gap-3"><button className="btn-ghost" onClick={() => setStep(2)}>Retour</button><button className="btn-gold" disabled={loading} onClick={go}>{loggedIn ? (choice.p.onlinePayment ? "Continuer vers le paiement" : "Envoyer la demande") : "Se connecter pour continuer"}</button></div>
        </section>
      )}
    </div>
  );
}
