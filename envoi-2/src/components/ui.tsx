import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_LABEL, type BookingStatus } from "@/modules/booking-state";

export function Field({ label, name, type = "text", defaultValue, required, hint, autoComplete, placeholder, min, max, step }: { label: string; name: string; type?: string; defaultValue?: string | number | null; required?: boolean; hint?: string; autoComplete?: string; placeholder?: string; min?: number; max?: number; step?: number }) {
  return (
    <div>
      <label htmlFor={name} className="lbl">{label}{required && <span aria-hidden className="text-bad"> *</span>}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} required={required} autoComplete={autoComplete} placeholder={placeholder} min={min} max={max} step={step} className="field" />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
export function Alert({ kind = "info", children }: { kind?: "info" | "error" | "ok"; children: ReactNode }) {
  const c = kind === "error" ? "border-bad/30 bg-bad/5 text-bad" : kind === "ok" ? "border-ok/30 bg-ok/5 text-ok" : "border-gold/40 bg-gold-100 text-ink";
  return <div role={kind === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${c}`}>{children}</div>;
}
const TONE: Record<string, string> = { COMPLETED: "bg-ok/10 text-ok", ACCEPTED: "bg-ok/10 text-ok", EN_ROUTE: "bg-gold-100 text-gold-600", IN_PROGRESS: "bg-gold-100 text-gold-600", REQUESTED: "bg-stone-100 text-stone-700" };
export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[status] ?? (["CANCELLED", "REFUSED", "EXPIRED", "NO_SHOW_CLIENT", "NO_SHOW_PARTNER"].includes(status) ? "bg-bad/10 text-bad" : "bg-stone-100 text-stone-700")}`}>{STATUS_LABEL[status as BookingStatus] ?? status}</span>;
}
export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return <div className="mb-6"><h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>{sub && <p className="mt-2 max-w-2xl text-muted">{sub}</p>}</div>;
}
export function NavTabs({ items, current }: { items: [string, string][]; current: string }) {
  return (
    <nav aria-label="Navigation de l'espace" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {items.map(([href, label]) => (
        <Link key={href} href={href} aria-current={current === href ? "page" : undefined}
          className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${current === href ? "border-gold text-ink" : "border-transparent text-muted hover:text-ink"}`}>{label}</Link>
      ))}
    </nav>
  );
}
