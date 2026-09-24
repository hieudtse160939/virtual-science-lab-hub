import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <div className="bg-muted text-muted-foreground mb-4 flex size-14 items-center justify-center rounded-2xl">
        <SearchX className="size-7" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold">{t.errors.notFoundTitle}</h1>
      <p className="text-muted-foreground mt-2">{t.errors.notFoundHint}</p>
      <div className="mt-6 flex gap-2">
        <Button asChild>
          <Link href="/search">{t.nav.explore}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">{t.errors.goHome}</Link>
        </Button>
      </div>
    </div>
  );
}
