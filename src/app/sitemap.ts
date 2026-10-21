import type { MetadataRoute } from "next";
const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/comment-ca-marche", "/prestations", "/zones", "/devenir-partenaire", "/a-propos", "/faq", "/contact", "/reserver", "/legal/conditions-generales", "/legal/confidentialite", "/legal/annulation", "/legal/mentions-legales", "/legal/cookies"].map((p) => ({ url: base + p }));
}
