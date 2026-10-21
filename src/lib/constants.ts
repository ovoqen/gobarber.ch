export const SITE = { name: "GoBarber.ch", url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200" };
export const WEEKDAYS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const toHM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const fromHM = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };
