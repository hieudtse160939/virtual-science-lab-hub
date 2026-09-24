import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

const FEATURED_SOURCES = [
  { name: "PhET", slug: "phet" },
  { name: "ChemCollective", slug: "chemcollective" },
  { name: "Concord Consortium", slug: "concord-consortium" },
  { name: "LabXchange", slug: "labxchange" },
  { name: "NOVA Labs", slug: "nova-labs" },
];

export async function SiteFooter() {
  const { t } = await getI18n();
  return (
    <footer className="no-print bg-card mt-16 border-t">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-bold">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <FlaskConical className="size-4" aria-hidden />
            </span>
            {t.meta.siteName}
          </div>
          <p className="text-muted-foreground max-w-md text-sm">{t.footer.tagline}</p>
          <p className="text-muted-foreground max-w-md text-xs">{t.footer.copyright}</p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">{t.footer.sources}</h2>
          <ul className="text-muted-foreground space-y-2 text-sm">
            {FEATURED_SOURCES.map((s) => (
              <li key={s.slug}>
                <Link href={`/search?source=${s.slug}`} className="hover:text-foreground hover:underline">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">{t.footer.about}</h2>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li>
              <Link href="/search" className="hover:text-foreground hover:underline">
                {t.nav.explore}
              </Link>
            </li>
            <li>
              <Link href="/teacher" className="hover:text-foreground hover:underline">
                {t.nav.teacher}
              </Link>
            </li>
            <li>
              <a href="/sitemap.xml" className="hover:text-foreground hover:underline">
                {t.footer.sitemap}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
