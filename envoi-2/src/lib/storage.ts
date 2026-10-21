import "server-only";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";
// Stockage local PRIVÉ (hors dossier public). En production : bucket objet privé (S3/R2) avec URLs signées — voir docs/SERVICES-EXTERNES.md.
const ROOT = path.join(process.cwd(), "storage");
const OK: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
// Les documents (pièces d'identité…) sont chiffrés au repos (AES-256-GCM). Clé : DOC_ENCRYPTION_KEY (32 octets en base64 ou hex) — obligatoire en production.
function key() {
  const k = process.env.DOC_ENCRYPTION_KEY;
  if (k) { const b = /^[0-9a-f]{64}$/i.test(k) ? Buffer.from(k, "hex") : Buffer.from(k, "base64"); if (b.length !== 32) throw new Error("DOC_ENCRYPTION_KEY doit faire 32 octets"); return b; }
  if (process.env.NODE_ENV === "production") throw new Error("DOC_ENCRYPTION_KEY manquant");
  return createHash("sha256").update("dev-doc-key|" + (process.env.SESSION_SECRET ?? "")).digest();
}
const seal = (buf: Buffer) => { const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv), enc = Buffer.concat([c.update(buf), c.final()]); return Buffer.concat([iv, c.getAuthTag(), enc]); };
const unseal = (buf: Buffer) => { const d = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12)); d.setAuthTag(buf.subarray(12, 28)); return Buffer.concat([d.update(buf.subarray(28)), d.final()]); };

export async function saveUpload(file: File, folder: "docs" | "photos", maxMb: number) {
  const ext = OK[file.type]; if (!ext) throw new Error("Format accepté : PDF, JPG ou PNG.");
  if (file.size > maxMb * 1024 * 1024) throw new Error(`Fichier trop lourd (max ${maxMb} Mo).`);
  const buf = Buffer.from(await file.arrayBuffer());
  // Contrôle des « magic bytes » : le type annoncé par le navigateur ne suffit pas.
  const sig = buf.subarray(0, 4).toString("hex");
  if (!((ext === "pdf" && sig === "25504446") || (ext === "jpg" && sig.startsWith("ffd8ff")) || (ext === "png" && sig === "89504e47"))) throw new Error("Contenu du fichier invalide.");
  const name = `${randomBytes(16).toString("hex")}.${ext}`;
  await mkdir(path.join(ROOT, folder), { recursive: true }); await writeFile(path.join(ROOT, folder, name), folder === "docs" ? seal(buf) : buf);
  return `${folder}/${name}`;
}
export async function readUpload(ref: string) {
  if (!/^(docs|photos)\/[a-f0-9]{32}\.(pdf|jpg|png)$/.test(ref)) throw new Error("ref");
  const raw = await readFile(path.join(ROOT, ref));
  return { data: ref.startsWith("docs/") ? unseal(raw) : raw, type: ref.endsWith("pdf") ? "application/pdf" : ref.endsWith("png") ? "image/png" : "image/jpeg" };
}
