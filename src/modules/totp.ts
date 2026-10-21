// TOTP (RFC 6238) sans dépendance : 2FA obligatoire pour l'administration.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newSecret() {
  const b = randomBytes(20); let bits = "", out = "";
  for (const x of b) bits += x.toString(2).padStart(8, "0");
  for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHA[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function decode(s: string) {
  let bits = ""; for (const c of s.replace(/=+$/, "")) bits += ALPHA.indexOf(c).toString(2).padStart(5, "0");
  const bytes: number[] = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
export function totpAt(secret: string, t = Date.now(), step = 30, digits = 6) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(t / 1000 / step)));
  const h = createHmac("sha1", decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h[o] & 0x7f) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 10 ** digits;
  return String(code).padStart(digits, "0");
}
/** Tolère ±1 fenêtre (30 s) de dérive d'horloge. */
export function verifyTotp(secret: string, code: string, t = Date.now()) {
  const c = code.replace(/\s/g, ""); if (!/^\d{6}$/.test(c)) return false;
  return [-1, 0, 1].some((w) => { const e = Buffer.from(totpAt(secret, t + w * 30_000)); return timingSafeEqual(e, Buffer.from(c)); });
}
export const otpauthUrl = (email: string, secret: string) => `otpauth://totp/GoBarber.ch:${encodeURIComponent(email)}?secret=${secret}&issuer=GoBarber.ch`;
