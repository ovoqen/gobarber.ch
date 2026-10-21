import type { ReactNode } from "react";

export function Kpi({ label, value, hint, accent = false }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="card relative overflow-hidden">
      {accent && <div aria-hidden className="absolute -right-8 -top-8 size-28 rounded-full bg-[radial-gradient(closest-side,rgba(184,145,58,.35),transparent)]" />}
      <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-muted">{label}</p>
      <p className={`kpi-num mt-2 text-4xl sm:text-5xl ${accent ? "text-gold" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Histogramme SVG accessible (résumé en aria-label + tableau masqué pour les lecteurs d'écran). */
export function BarChart({ data, unit = "", title }: { data: { label: string; value: number }[]; unit?: string; title: string }) {
  const max = Math.max(1, ...data.map((d) => d.value)), W = 640, H = 160, bw = W / data.length;
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label={`${title} : ${total}${unit} sur ${data.length} jours`} className="w-full">
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e2c77a" /><stop offset="1" stopColor="#9c7a2c" /></linearGradient></defs>
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="0" x2={W} y1={H - H * f} y2={H - H * f} stroke="rgba(255,255,255,.07)" />)}
        {data.map((d, i) => { const h = (d.value / max) * (H - 6); return (
          <g key={i}><rect x={i * bw + bw * 0.18} y={H - h} width={bw * 0.64} height={Math.max(h, d.value ? 2 : 0)} rx="2" fill="url(#g)"><title>{`${d.label} : ${d.value}${unit}`}</title></rect>
            {(i % 5 === 0 || i === data.length - 1) && <text x={i * bw + bw / 2} y={H + 16} textAnchor="middle" fontSize="10" fill="rgba(246,241,231,.5)">{d.label}</text>}</g>); })}
      </svg>
      <table className="sr-only"><caption>{title}</caption><tbody>{data.map((d) => <tr key={d.label}><th>{d.label}</th><td>{d.value}{unit}</td></tr>)}</tbody></table>
    </figure>
  );
}
export const Section = ({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) => <section className="card"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-2xl">{title}</h2>{aside}</div>{children}</section>;
