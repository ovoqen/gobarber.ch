import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireStaff("audit.view");
  const rows = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId).filter(Boolean) as string[] } }, select: { id: true, email: true } }); const m = new Map(users.map((u) => [u.id, u.email]));
  return <div className="space-y-3"><h1 className="text-3xl font-semibold">Journal des actions</h1><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Date</th><th>Auteur</th><th>Action</th><th>Objet</th><th>Détail</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id} className="border-b border-line align-top"><td className="whitespace-nowrap py-2">{r.createdAt.toLocaleString("fr-CH", { timeZone: "Europe/Zurich" })}</td><td>{r.userId ? m.get(r.userId) ?? r.userId : "système"}</td><td>{r.action}</td><td>{r.entity} {r.entityId}</td><td className="max-w-md break-words text-xs text-muted">{r.diff}</td></tr>)}</tbody></table></div></div>;
}
