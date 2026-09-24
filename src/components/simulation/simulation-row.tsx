"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import type { SimulationCardData } from "@/types/domain";
import { SimulationCard } from "./simulation-card";

/** Hàng cuộn ngang kiểu "Netflix" – hỗ trợ vuốt, cuộn bằng nút và bàn phím. */
export function SimulationRow({
  title,
  href,
  items,
  headingId,
}: {
  title: string;
  href?: string;
  items: SimulationCardData[];
  headingId: string;
}) {
  const { t } = useI18n();
  const scroller = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h2 id={headingId} className="text-xl font-bold tracking-tight sm:text-2xl">
          {title}
        </h2>
        <div className="flex items-center gap-1">
          {href && (
            <Button asChild variant="link" className="mr-2">
              <Link href={href}>{t.common.viewAll}</Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => scroll(-1)}
            aria-label={t.common.previous}
            className="hidden sm:inline-flex"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => scroll(1)}
            aria-label={t.common.next}
            className="hidden sm:inline-flex"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <ul
        ref={scroller}
        className="-mx-4 flex snap-x snap-mandatory scrollbar-none gap-4 overflow-x-auto scroll-smooth px-4 pb-2 sm:mx-0 sm:px-0"
      >
        {items.map((sim) => (
          <li key={sim.id} className="w-[78%] shrink-0 snap-start sm:w-[45%] md:w-[31%] lg:w-[23.5%]">
            <SimulationCard sim={sim} />
          </li>
        ))}
      </ul>
    </section>
  );
}
