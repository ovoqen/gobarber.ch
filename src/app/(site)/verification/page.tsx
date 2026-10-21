import Link from "next/link";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";
import { Alert } from "@/components/ui";
export const metadata = { title: "Vérification de l'e-mail" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const t = (await searchParams).token;
  const uid = t ? await consumeToken(t, "VERIFY_EMAIL") : null;
  if (uid) await db.user.update({ where: { id: uid }, data: { emailVerifiedAt: new Date() } });
  return <div className="container-x max-w-md py-12 space-y-4">{uid ? <Alert kind="ok">Adresse confirmée. Vous pouvez vous connecter.</Alert> : <Alert kind="error">Lien invalide ou expiré.</Alert>}<Link href="/connexion" className="btn-dark">Connexion</Link></div>;
}
