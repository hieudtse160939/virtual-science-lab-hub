"use client";

import Image from "next/image";
import { useState } from "react";
import { SubjectIcon } from "@/components/subject-icon";
import { cn } from "@/lib/utils";

/** Ảnh xem trước; khi ảnh lỗi/không có → ảnh thay thế theo màu và biểu tượng môn học. */
export function SimulationThumbnail({
  src,
  alt,
  color,
  icon,
  className,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
  priority,
}: {
  src: string | null;
  alt: string;
  color?: string | null;
  icon?: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const tint = color ?? "#64748b";
  return (
    <div className={cn("bg-muted relative aspect-video overflow-hidden", className)}>
      {src && !failed ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${tint}26, ${tint}0d)`, color: tint }}
          role="img"
          aria-label={alt}
        >
          <SubjectIcon icon={icon} className="size-10 opacity-80" />
        </div>
      )}
    </div>
  );
}
