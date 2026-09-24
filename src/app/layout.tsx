import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { displayPrefsScript, Providers, type ClientUser } from "@/components/providers";
import { getI18n } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/utils";
import { getSession } from "@/server/auth";
import "./globals.css";

const font = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t.meta.defaultTitle, template: `%s | ${t.meta.siteName}` },
    description: t.meta.defaultDescription,
    applicationName: t.meta.siteName,
    openGraph: {
      type: "website",
      siteName: t.meta.siteName,
      locale: locale === "vi" ? "vi_VN" : "en_US",
      title: t.meta.defaultTitle,
      description: t.meta.defaultDescription,
    },
    twitter: { card: "summary_large_image" },
    alternates: { canonical: "/" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, t }, session] = await Promise.all([getI18n(), getSession()]);
  const user: ClientUser | null = session
    ? {
        id: session.user.id,
        email: session.user.email ?? null,
        name: session.profile.full_name,
        role: session.profile.role,
      }
    : null;

  return (
    <html lang={locale} suppressHydrationWarning className={font.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: displayPrefsScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <a
          href="#main-content"
          className="bg-primary text-primary-foreground sr-only z-50 rounded-lg px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t.nav.skipToContent}
        </a>
        <Providers locale={locale} t={t} user={user}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
