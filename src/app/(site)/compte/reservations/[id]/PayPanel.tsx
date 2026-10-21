"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";

/** Paiement : démonstration (boutons) ou Stripe (Payment Element hébergé : carte, Apple Pay, Google Pay, TWINT — nous ne voyons jamais les données de carte). */
export function PayPanel({ id, total, demo }: { id: string; total: string; demo: boolean }) {
  const r = useRouter(); const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [ready, setReady] = useState(false);
  const stripe = useRef<Stripe | null>(null), elements = useRef<StripeElements | null>(null), mount = useRef<HTMLDivElement>(null);

  async function start(simulateFailure = false) {
    setBusy(true); setErr("");
    const res = await fetch(`/api/bookings/${id}/pay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ simulateFailure }) });
    const j = await res.json(); setBusy(false);
    if (!res.ok) { setErr(j.error ?? "Paiement impossible"); return; }
    if (j.kind === "done") { r.refresh(); return; }
    const s = await loadStripe(j.publishableKey); if (!s) { setErr("Service de paiement indisponible."); return; }
    stripe.current = s;
    elements.current = s.elements({ clientSecret: j.clientSecret, locale: "fr", appearance: { theme: "night", variables: { colorPrimary: "#c9a24a", borderRadius: "10px" } } });
    elements.current.create("payment", { wallets: { applePay: "auto", googlePay: "auto" } }).mount(mount.current!);
    setReady(true);
  }
  async function confirm() {
    if (!stripe.current || !elements.current) return; setBusy(true); setErr("");
    const { error } = await stripe.current.confirmPayment({ elements: elements.current, confirmParams: { return_url: `${window.location.origin}/compte/reservations/${id}?paid=1` } });
    if (error) { setErr(error.message ?? "Paiement refusé"); setBusy(false); } // en cas de succès, Stripe redirige vers return_url
  }
  return (
    <div className="card space-y-3">
      <h2 className="text-xl font-semibold">Paiement — {total}</h2>
      {demo && <p className="rounded-lg bg-gold-100 p-3 text-sm"><strong>Mode démonstration</strong> : aucun argent n'est débité et aucune carte n'est demandée.</p>}
      <p className="text-sm text-muted">{demo ? "Le montant est seulement réservé ; il n'est débité qu'à l'acceptation du barbier, et libéré s'il refuse ou ne répond pas." : "Paiement sécurisé par notre prestataire : vos données de carte ne passent jamais par GoBarber.ch."}</p>
      <div ref={mount} className={ready ? "" : "hidden"} />
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div className="flex flex-wrap gap-2">
        {ready ? <button className="btn-gold" disabled={busy} onClick={confirm}>Payer {total}</button>
          : <button className="btn-gold" disabled={busy} onClick={() => start(false)}>{demo ? "Payer (simulation)" : "Continuer vers le paiement"}</button>}
        {demo && !ready && <button className="btn-ghost" disabled={busy} onClick={() => start(true)}>Simuler un échec</button>}
      </div>
    </div>
  );
}

/** Après retour de Stripe : on attend la confirmation par webhook (quelques secondes) en rafraîchissant la page. */
export function WaitForConfirmation() {
  const r = useRouter(); const [n, setN] = useState(0);
  useEffect(() => { if (n >= 20) return; const t = setTimeout(() => { r.refresh(); setN(n + 1); }, 1500); return () => clearTimeout(t); }, [n, r]);
  return <p role="status" className="rounded-lg bg-gold-100 p-3 text-sm">Confirmation de votre paiement en cours… {n >= 20 && "Cela prend plus de temps que prévu : actualisez la page dans un instant."}</p>;
}
