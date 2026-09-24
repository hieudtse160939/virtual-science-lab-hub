import { siteUrl } from "@/lib/utils";
import { getSubjects } from "@/server/repositories/catalog";
import { listSitemapSimulations } from "@/server/repositories/simulations";

export const revalidate = 3600;

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function urlset(urls: { loc: string; lastmod?: string; priority?: number }[]) {
  const body = urls
    .map(
      (u) =>
        `<url><loc>${escape(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}${u.priority ? `<priority>${u.priority}</priority>` : ""}</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  let xml: string;
  if (name === "static.xml") {
    const subjects = await getSubjects().catch(() => []);
    xml = urlset([
      { loc: siteUrl("/"), priority: 1 },
      { loc: siteUrl("/search"), priority: 0.9 },
      ...subjects.map((s) => ({ loc: siteUrl(`/search?subject=${s.slug}`), priority: 0.7 })),
    ]);
  } else {
    const match = /^simulations-(\d{1,4})\.xml$/.exec(name);
    if (!match) return new Response("Not found", { status: 404 });
    const rows = await listSitemapSimulations(Number(match[1]));
    if (rows.length === 0 && Number(match[1]) > 0) return new Response("Not found", { status: 404 });
    xml = urlset(
      rows.map((r) => ({
        loc: siteUrl(`/simulation/${r.slug}`),
        lastmod: new Date(r.updated_at).toISOString(),
        priority: 0.8,
      })),
    );
  }
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, s-maxage=3600" },
  });
}
