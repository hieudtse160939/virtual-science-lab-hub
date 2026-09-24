import { siteUrl } from "@/lib/utils";
import { SITEMAP_CHUNK, countPublishedSimulations } from "@/server/repositories/simulations";

export const revalidate = 3600;

/** Sitemap index: 1 tệp trang tĩnh + N tệp mô phỏng (mỗi tệp ≤ 40.000 URL, dưới giới hạn 50.000 của Google). */
export async function GET() {
  let total = 0;
  try {
    total = await countPublishedSimulations();
  } catch {
    total = 0;
  }
  const chunks = Math.max(1, Math.ceil(total / SITEMAP_CHUNK));
  const now = new Date().toISOString();
  const entries = [
    `<sitemap><loc>${siteUrl("/sitemaps/static.xml")}</loc><lastmod>${now}</lastmod></sitemap>`,
    ...Array.from(
      { length: chunks },
      (_, i) =>
        `<sitemap><loc>${siteUrl(`/sitemaps/simulations-${i}.xml`)}</loc><lastmod>${now}</lastmod></sitemap>`,
    ),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</sitemapindex>`;
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, s-maxage=3600" },
  });
}
