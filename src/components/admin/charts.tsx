"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { formatDate, formatNumber } from "@/lib/i18n/config";

export interface BarDatum {
  key: string;
  label: string;
  label_en: string;
  value: number;
}

/**
 * Biểu đồ thanh ngang một chuỗi (độ lớn): một màu, nhãn và giá trị bằng chữ (không phụ thuộc màu),
 * đầu thanh bo 4px, khoảng cách giữa thanh, lưới mờ. Mỗi hàng đồng thời là một hàng dữ liệu đọc được.
 */
export function BarList({ title, data, max = 12 }: { title: string; data: BarDatum[]; max?: number }) {
  const { t, locale } = useI18n();
  const rows = data.slice(0, max);
  const peak = Math.max(1, ...rows.map((d) => d.value));
  return (
    <figure className="bg-card rounded-2xl border p-5 shadow-sm">
      <figcaption className="mb-4 font-semibold">{title}</figcaption>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.admin.charts.noData}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((d) => (
            <li
              key={d.key}
              className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm"
              title={`${d.label}: ${d.value}`}
            >
              <span className="text-muted-foreground truncate">{locale === "vi" ? d.label : d.label_en}</span>
              <span className="bg-muted h-3 rounded-r-[4px]" aria-hidden>
                <span
                  className="bg-primary block h-full rounded-r-[4px]"
                  style={{ width: `${Math.max((d.value / peak) * 100, d.value > 0 ? 1.5 : 0)}%` }}
                />
              </span>
              <span className="text-right font-medium tabular-nums">{formatNumber(d.value, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/** Biểu đồ cột theo ngày (một chuỗi) có tooltip khi rê chuột/focus và bảng dữ liệu cho trình đọc màn hình. */
export function DailyColumns({
  title,
  data,
  field,
}: {
  title: string;
  data: { day: string; views: number; opens: number }[];
  field: "views" | "opens";
}) {
  const { t, locale } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const peak = Math.max(1, ...data.map((d) => d[field]));
  const total = data.reduce((s, d) => s + d[field], 0);
  const current = active !== null ? data[active] : null;
  return (
    <figure className="bg-card rounded-2xl border p-5 shadow-sm">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <span className="text-2xl font-bold tabular-nums">{formatNumber(total, locale)}</span>
      </figcaption>
      <p className="text-muted-foreground mb-3 h-5 text-xs" aria-live="polite">
        {current ? `${formatDate(current.day, locale)}: ${formatNumber(current[field], locale)}` : " "}
      </p>
      <div
        className="border-border relative flex h-32 items-end gap-[2px] border-b"
        onMouseLeave={() => setActive(null)}
      >
        {data.map((d, i) => (
          <button
            key={d.day}
            type="button"
            className="group flex h-full flex-1 items-end focus-visible:outline-2"
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            aria-label={`${formatDate(d.day, locale)}: ${d[field]}`}
          >
            <span
              className={`block w-full rounded-t-[4px] ${active === i ? "bg-primary" : "bg-primary/70"}`}
              style={{ height: `${d[field] > 0 ? Math.max((d[field] / peak) * 100, 2) : 0}%` }}
            />
          </button>
        ))}
      </div>
      <div className="text-muted-foreground mt-1 flex justify-between text-[11px]">
        <span>{data[0] ? formatDate(data[0].day, locale, { day: "2-digit", month: "2-digit" }) : ""}</span>
        <span>
          {data.at(-1) ? formatDate(data.at(-1)!.day, locale, { day: "2-digit", month: "2-digit" }) : ""}
        </span>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{d[field]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {total === 0 && <p className="text-muted-foreground mt-2 text-xs">{t.admin.charts.noData}</p>}
    </figure>
  );
}
