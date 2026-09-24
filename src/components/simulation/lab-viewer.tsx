"use client";

import { ArrowLeft, ExternalLink, Flag, Loader2, Maximize, Minimize, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/config";
import { trackEvent } from "@/lib/track";
import { ReportDialog } from "./report-dialog";

interface LabSim {
  id: string;
  slug: string;
  title: string;
  simulation_url: string;
  embed_url: string | null;
  source: { name: string } | null;
}

export function LabViewer({
  sim,
  blockedReason,
  backHref,
  collectionId,
}: {
  sim: LabSim;
  /** null = được phép nhúng; ngược lại là lý do không thể nhúng. */
  blockedReason: "blocked" | "unreachable" | "not_embeddable" | null;
  backHref: string;
  collectionId?: string | null;
}) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (blockedReason) return;
    const key = `vsl:embed:${sim.id}`;
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        trackEvent(sim.id, "embed_open", collectionId);
      }
    } catch {
      trackEvent(sim.id, "embed_open", collectionId);
    }
    const timer = setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(timer);
  }, [sim.id, blockedReason, collectionId]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await container.current?.requestFullscreen();
    } catch {
      // Trình duyệt không hỗ trợ (ví dụ iOS Safari) → bỏ qua
    }
  }, []);

  const openOriginal = (
    <Button asChild variant="outline" size="sm">
      <a
        href={sim.simulation_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent(sim.id, "external_open", collectionId)}
      >
        <ExternalLink /> <span className="hidden sm:inline">{t.lab.openOriginal}</span>
      </a>
    </Button>
  );

  return (
    <div ref={container} className="bg-background flex h-dvh flex-col">
      <header className="bg-card flex h-14 shrink-0 items-center gap-2 border-b px-2 sm:px-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref}>
            <ArrowLeft /> <span className="hidden sm:inline">{t.lab.back}</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold sm:text-base">{sim.title}</h1>
          {sim.source && (
            <p className="text-muted-foreground truncate text-xs">
              {format(t.lab.poweredBy, { source: sim.source.name })}
            </p>
          )}
        </div>
        {!blockedReason && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? t.lab.exitFullscreen : t.lab.fullscreen}
          >
            {isFullscreen ? <Minimize /> : <Maximize />}
            <span className="hidden md:inline">{isFullscreen ? t.lab.exitFullscreen : t.lab.fullscreen}</span>
          </Button>
        )}
        {openOriginal}
        <ReportDialog
          simulationId={sim.id}
          defaultReason={blockedReason ? "embed_blocked" : "broken_link"}
          trigger={
            <Button variant="ghost" size="sm" aria-label={t.lab.reportIssue}>
              <Flag /> <span className="hidden lg:inline">{t.lab.reportIssue}</span>
            </Button>
          }
        />
      </header>

      {blockedReason || !sim.embed_url ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div
            role="alert"
            className="bg-card max-w-md space-y-4 rounded-2xl border p-8 text-center shadow-sm"
          >
            <div className="bg-warning-soft text-warning mx-auto flex size-14 items-center justify-center rounded-2xl">
              <ShieldAlert className="size-7" aria-hidden />
            </div>
            <p className="text-lg font-semibold">{t.lab.blocked}</p>
            <p className="text-muted-foreground text-sm">
              {blockedReason === "unreachable"
                ? t.lab.unreachable
                : blockedReason === "not_embeddable"
                  ? t.lab.notEmbeddable
                  : t.lab.blockedReason}
            </p>
            <Button asChild size="lg">
              <a
                href={sim.simulation_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent(sim.id, "external_open", collectionId)}
              >
                <ExternalLink /> {t.lab.openOriginal}
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 bg-black/5 dark:bg-black/40">
          {!loaded && (
            <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm">
              <Loader2 className="size-8 animate-spin" aria-hidden />
              <span role="status">{t.common.loading}</span>
            </div>
          )}
          {slow && (
            <p className="bg-card/95 absolute inset-x-0 bottom-3 z-10 mx-auto w-fit max-w-[90%] rounded-full px-4 py-2 text-center text-xs shadow-md">
              {t.lab.slowHint}{" "}
              <a
                href={sim.simulation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-semibold underline"
              >
                {t.lab.openOriginal}
              </a>
            </p>
          )}
          <iframe
            src={sim.embed_url}
            title={format(t.lab.frameTitle, { title: sim.title })}
            className="absolute inset-0 h-full w-full border-0"
            allow="fullscreen; autoplay; clipboard-write"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads"
            onLoad={() => {
              setLoaded(true);
              setSlow(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
