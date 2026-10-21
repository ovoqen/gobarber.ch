"use client";
import dynamic from "next/dynamic";
const Carte = dynamic(() => import("./CarteGeneve3D"), { ssr: false, loading: () => null });
export default function AdminMap({ counts }: { counts: Record<string, number> }) {
  return <div className="-mx-2 h-[300px] [&>div]:!h-[300px] [mask-image:radial-gradient(closest-side,#000_75%,transparent)] [-webkit-mask-image:radial-gradient(closest-side,#000_75%,transparent)]"><Carte counts={counts} onPick={() => {}} /></div>;
}
