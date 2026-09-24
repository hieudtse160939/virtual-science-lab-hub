"use client";

import { ExternalLink, Heart, Play } from "lucide-react";
import Link from "next/link";
import { useFavorites } from "@/components/providers";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/config";
import { isEmbeddable } from "@/lib/embed";
import { trackEvent } from "@/lib/track";
import { cn } from "@/lib/utils";
import type { SimulationCardData } from "@/types/domain";

type OpenTarget = Pick<
  SimulationCardData,
  "id" | "slug" | "title" | "simulation_url" | "embed_url" | "source"
>;

/** Nút mở mô phỏng: trong ứng dụng nếu được phép nhúng, ngược lại mở trang gốc ở tab mới. */
export function OpenSimulationButton({
  sim,
  collectionId,
  label,
  className,
  size,
  variant,
}: {
  sim: OpenTarget;
  collectionId?: string | null;
  label?: string;
  className?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) {
  const { t } = useI18n();
  const text = label ?? t.card.open;
  const aria = format(t.card.openLabel, { title: sim.title });

  if (isEmbeddable(sim)) {
    const href = `/lab/${sim.slug}${collectionId ? `?collection=${collectionId}` : ""}`;
    return (
      <Button asChild size={size} variant={variant} className={className}>
        <Link href={href} aria-label={aria} title={t.card.inApp}>
          <Play /> {text}
        </Link>
      </Button>
    );
  }
  return (
    <Button asChild size={size} variant={variant} className={className}>
      <a
        href={sim.simulation_url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${aria} (${t.card.external})`}
        title={t.card.external}
        onClick={() => trackEvent(sim.id, "external_open", collectionId)}
      >
        <ExternalLink /> {text}
      </a>
    </Button>
  );
}

export function FavoriteButton({
  id,
  title,
  withLabel = false,
  className,
  size,
}: {
  id: string;
  title: string;
  withLabel?: boolean;
  className?: string;
  size?: ButtonProps["size"];
}) {
  const { t } = useI18n();
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(id);
  return (
    <Button
      variant="outline"
      size={size ?? (withLabel ? "default" : "icon")}
      aria-pressed={active}
      aria-label={format(active ? t.card.unsaveLabel : t.card.saveLabel, { title })}
      onClick={() => void toggle(id, title)}
      className={cn(
        active && "border-rose-300 text-rose-600 dark:border-rose-800 dark:text-rose-400",
        className,
      )}
    >
      <Heart className={cn(active && "fill-current")} />
      {withLabel && (active ? t.card.saved : t.card.save)}
    </Button>
  );
}
