import { geo, siteUrl } from "@/lib/geo";

export function GET(): Response {
  const xml = geo.sitemap(["/", "/#features", "/#how-it-works", "/#install"]).replace(
    "<lastmod>",
    "<changefreq>weekly</changefreq><priority>1.0</priority><lastmod>",
  );
  return new Response(xml.replace(siteUrl, siteUrl.replace(/\/+$/, "")), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
