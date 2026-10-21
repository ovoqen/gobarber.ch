import Link from "next/link";
import type { ReactNode } from "react";
// Rendu Markdown minimal et SÛR (aucun HTML brut interprété) : titres, listes, citations, gras/italique, liens internes.
function inline(s: string): ReactNode[] {
  const out: ReactNode[] = []; const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((\/[^)\s]*)\)/g; let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) out.push(<strong key={k++}>{m[1]}</strong>); else if (m[2]) out.push(<em key={k++}>{m[2]}</em>);
    else out.push(<Link key={k++} href={m[4]} className="text-gold-600 underline">{m[3]}</Link>);
    last = re.lastIndex;
  }
  out.push(s.slice(last)); return out;
}
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []; const lines = text.trim().split("\n"); let list: string[] = [], ordered = false, k = 0;
  const flush = () => { if (!list.length) return; const items = list.map((l, i) => <li key={i}>{inline(l)}</li>); blocks.push(ordered ? <ol key={k++} className="ml-5 list-decimal space-y-1">{items}</ol> : <ul key={k++} className="ml-5 list-disc space-y-1">{items}</ul>); list = []; };
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (/^\d+\.\s/.test(l)) { if (!ordered) flush(); ordered = true; list.push(l.replace(/^\d+\.\s/, "")); continue; }
    if (/^[-*]\s/.test(l)) { if (ordered) flush(); ordered = false; list.push(l.slice(2)); continue; }
    flush();
    if (!l) continue;
    if (l.startsWith("## ")) blocks.push(<h2 key={k++} className="mt-8 text-2xl font-semibold">{inline(l.slice(3))}</h2>);
    else if (l.startsWith("> ")) blocks.push(<p key={k++} className="rounded-lg border border-gold/40 bg-gold-100 px-4 py-3 text-sm">{inline(l.slice(2))}</p>);
    else blocks.push(<p key={k++}>{inline(l)}</p>);
  }
  flush();
  return <div className="space-y-3 leading-relaxed">{blocks}</div>;
}
