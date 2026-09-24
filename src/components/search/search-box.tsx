"use client";

import { Loader2, Search, TrendingUp, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { SubjectIcon } from "@/components/subject-icon";
import { MAX_QUERY_LENGTH } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

interface Suggestion {
  queries: string[];
  simulations: {
    slug: string;
    title: string;
    subject: { icon: string; color: string; name: string; name_vi: string } | null;
  }[];
}

type Option =
  | { kind: "query"; value: string }
  | { kind: "simulation"; slug: string; title: string; subject: Suggestion["simulations"][number]["subject"] }
  | { kind: "all"; value: string };

interface SearchBoxProps {
  variant?: "hero" | "header" | "page";
  defaultValue?: string;
  placeholder?: string;
  /** Giữ các bộ lọc hiện có trên URL khi tìm (trang /search). */
  preserveFilters?: boolean;
  autoFocus?: boolean;
  className?: string;
  onSubmitted?: () => void;
}

export function SearchBox({
  variant = "header",
  defaultValue = "",
  placeholder,
  preserveFilters = false,
  autoFocus,
  className,
  onSubmitted,
}: SearchBoxProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Suggestion>({ queries: [], simulations: [] });
  const [active, setActive] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => setValue(defaultValue), [defaultValue]);

  // Gợi ý có debounce 200ms, hủy request cũ khi gõ tiếp.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setData({ queries: [], simulations: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? (r.json() as Promise<Suggestion>) : { queries: [], simulations: [] }))
        .then((res) => {
          setData(res);
          setActive(-1);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [value]);

  const q = value.trim();
  const options: Option[] = [
    ...data.queries.filter((s) => s !== q.toLowerCase()).map((s) => ({ kind: "query" as const, value: s })),
    ...data.simulations.map((s) => ({ kind: "simulation" as const, ...s })),
    ...(q.length >= 2 ? [{ kind: "all" as const, value: q }] : []),
  ];
  const showList = open && q.length >= 2 && (options.length > 1 || loading);

  const goSearch = (query: string) => {
    const params = preserveFilters ? new URLSearchParams(searchParams.toString()) : new URLSearchParams();
    params.delete("cursor");
    if (query) params.set("q", query);
    else params.delete("q");
    if (query && preserveFilters && params.get("sort") && params.get("sort") !== "relevance")
      params.delete("sort");
    setOpen(false);
    router.push(`/search${params.size > 0 ? `?${params}` : ""}`);
    onSubmitted?.();
  };

  const choose = (opt: Option) => {
    if (opt.kind === "simulation") {
      setOpen(false);
      router.push(`/simulation/${opt.slug}`);
      onSubmitted?.();
    } else {
      setValue(opt.value);
      goSearch(opt.value);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const opt = active >= 0 ? options[active] : undefined;
    if (opt && showList) choose(opt);
    else goSearch(q);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showList && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(options.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const isHero = variant === "hero";
  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <form role="search" onSubmit={onSubmit} className={cn("relative w-full", className)}>
      <label htmlFor={`${listId}-input`} className="sr-only">
        {t.search.label}
      </label>
      <div
        className={cn(
          "border-input bg-card focus-within:border-ring focus-within:ring-ring/15 flex items-center gap-2 border shadow-sm transition-shadow focus-within:ring-4",
          isHero ? "h-16 rounded-2xl pr-2 pl-5 text-lg" : "h-11 rounded-xl pr-1.5 pl-3.5 text-sm",
        )}
      >
        <Search aria-hidden className={cn("text-muted-foreground shrink-0", isHero ? "size-6" : "size-4")} />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          enterKeyHint="search"
          maxLength={MAX_QUERY_LENGTH}
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder ?? t.search.placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {loading && <Loader2 aria-hidden className="text-muted-foreground size-4 shrink-0 animate-spin" />}
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1"
            aria-label={t.common.clear}
          >
            <X className="size-4" />
          </button>
        )}
        <button
          type="submit"
          className={cn(
            "bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 rounded-xl font-semibold",
            isHero ? "h-12 px-6 text-base" : "h-8 rounded-lg px-3 text-xs",
          )}
        >
          {t.search.submit}
        </button>
      </div>

      {showList && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          aria-label={t.search.suggestions}
          className="bg-popover absolute inset-x-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border p-1.5 text-left text-sm shadow-xl"
        >
          {options.map((opt, i) => (
            <li
              key={`${opt.kind}-${"slug" in opt ? opt.slug : opt.value}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(opt)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5",
                i === active && "bg-accent",
                opt.kind === "all" && "text-primary mt-1 border-t pt-3 font-medium",
              )}
            >
              {opt.kind === "query" && (
                <>
                  <TrendingUp aria-hidden className="text-muted-foreground size-4" />
                  <span className="truncate">{opt.value}</span>
                </>
              )}
              {opt.kind === "simulation" && (
                <>
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-md"
                    style={{
                      background: `${opt.subject?.color ?? "#64748b"}1f`,
                      color: opt.subject?.color ?? "#64748b",
                    }}
                  >
                    <SubjectIcon icon={opt.subject?.icon} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{opt.title}</span>
                  {opt.subject && (
                    <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
                      {locale === "vi" ? opt.subject.name_vi : opt.subject.name}
                    </span>
                  )}
                </>
              )}
              {opt.kind === "all" && (
                <>
                  <Search aria-hidden className="size-4" />
                  <span className="truncate">{format(t.search.seeAllResults, { q: opt.value })}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
