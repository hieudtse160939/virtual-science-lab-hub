"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import Papa from "papaparse";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileUp,
  Loader2,
  RotateCcw,
  Sparkles,
  Square,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiFetch, errorMessage } from "@/lib/api-client";
import {
  CSV_COLUMNS,
  OPTIONAL_COLUMNS,
  buildSubjectMatcher,
  normalizeRecord,
  type ImportErrorCode,
  type ImportIssue,
  type ImportRecord,
  type SubjectLookup,
} from "@/lib/import/normalize";
import {
  MAX_IMPORT_BYTES,
  buildCsvTemplate,
  detectFormat,
  parseImportFile,
  type ImportFormat,
} from "@/lib/import/parse";
import { useI18n } from "@/lib/i18n/client";
import { format, formatDate, formatNumber } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import type { ImportJob } from "@/server/repositories/admin";

const BATCH_SIZE = 500;
const CONCURRENCY = 3;
const CHECK_CHUNK = 5000;

type Phase = "idle" | "parsing" | "checking" | "preview" | "importing" | "done";

interface Prepared {
  row: number;
  urlKey: string;
  record: ImportRecord;
  auto: boolean;
}

interface RowError extends ImportIssue {
  message?: string;
}

interface Totals {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
}

function Stat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger";
  sub?: string;
}) {
  return (
    <div className="bg-card rounded-2xl border p-4 shadow-sm">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div
        className="bg-muted h-3 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ErrorList({ errors }: { errors: RowError[] }) {
  const { t } = useI18n();
  const parent = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: errors.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 40,
    overscan: 12,
  });
  const codes = t.import.errorCodes as Record<ImportErrorCode, string>;
  return (
    <div className="bg-card rounded-2xl border">
      <div
        className="bg-muted/50 text-muted-foreground grid grid-cols-[5rem_9rem_1fr] gap-3 border-b px-4 py-2 text-xs font-semibold"
        role="row"
      >
        <span role="columnheader">{t.import.row}</span>
        <span role="columnheader">{t.import.field}</span>
        <span role="columnheader">{t.import.message}</span>
      </div>
      <div ref={parent} className="max-h-96 overflow-y-auto" role="table" aria-label={t.import.errorList}>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }} role="rowgroup">
          {virtualizer.getVirtualItems().map((v) => {
            const e = errors[v.index]!;
            return (
              <div
                key={v.key}
                role="row"
                className="absolute inset-x-0 grid grid-cols-[5rem_9rem_1fr] items-center gap-3 border-b px-4 text-sm"
                style={{ height: v.size, transform: `translateY(${v.start}px)` }}
              >
                <span role="cell" className="tabular-nums">
                  {e.row}
                </span>
                <span role="cell" className="truncate font-mono text-xs">
                  {e.field}
                </span>
                <span role="cell" className="truncate" title={e.message ?? e.value}>
                  {codes[e.code] ?? e.code}
                  {e.value ? <span className="text-muted-foreground"> — {e.value}</span> : null}
                  {e.message ? <span className="text-muted-foreground"> — {e.message}</span> : null}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function downloadText(name: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿", text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function Importer({ subjects, history }: { subjects: SubjectLookup[]; history: ImportJob[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const n = (v: number) => formatNumber(v, locale);

  const [phase, setPhase] = useState<Phase>("idle");
  const [fileInfo, setFileInfo] = useState<{ name: string; format: ImportFormat } | null>(null);
  const [parseProgress, setParseProgress] = useState(0);
  const [detected, setDetected] = useState(0);
  const [fatal, setFatal] = useState<string | null>(null);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [dupInFile, setDupInFile] = useState(0);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [onDuplicate, setOnDuplicate] = useState<"skip" | "update">("skip");
  const [reviewAuto, setReviewAuto] = useState(true);
  const [markDemo, setMarkDemo] = useState(false);
  const [totals, setTotals] = useState<Totals>({ inserted: 0, updated: 0, skipped: 0, failed: 0 });
  const [batchesDone, setBatchesDone] = useState(0);
  const [batchCount, setBatchCount] = useState(0);
  const [failedBatches, setFailedBatches] = useState<number[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const prepared = useRef<Prepared[]>([]);
  const toSend = useRef<Prepared[]>([]);
  const jobId = useRef<string | null>(null);
  const cancelled = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const autoCount = prepared.current.filter((p) => p.auto).length;

  useEffect(() => {
    if (phase !== "importing") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = t.import.leaveWarning;
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase, t]);

  const reset = () => {
    prepared.current = [];
    toSend.current = [];
    jobId.current = null;
    setPhase("idle");
    setFileInfo(null);
    setParseProgress(0);
    setDetected(0);
    setFatal(null);
    setErrors([]);
    setDupInFile(0);
    setExisting(new Set());
    setTotals({ inserted: 0, updated: 0, skipped: 0, failed: 0 });
    setBatchesDone(0);
    setBatchCount(0);
    setFailedBatches([]);
    if (fileInput.current) fileInput.current.value = "";
  };

  // ---------------------------------------------------------------- 1. Đọc + chuẩn hóa
  const handleFile = async (file: File) => {
    reset();
    const fmt = detectFormat(file.name);
    if (!fmt) return setFatal(t.import.unsupported);
    if (file.size > MAX_IMPORT_BYTES) return setFatal(t.import.tooLarge);
    setFileInfo({ name: file.name, format: fmt });
    setPhase("parsing");

    const match = buildSubjectMatcher(subjects);
    const seen = new Map<string, number>();
    const rows: Prepared[] = [];
    const errs: RowError[] = [];
    let dups = 0;
    let count = 0;
    try {
      count = await parseImportFile(file, fmt, {
        onRecord: (raw, row) => {
          const res = normalizeRecord(raw, row, match, { reviewAutoClassified: false, isDemo: false });
          if (res.errors.length > 0 || !res.record || !res.urlKey) {
            errs.push(...res.errors);
            return;
          }
          const first = seen.get(res.urlKey);
          if (first !== undefined) {
            dups += 1;
            errs.push({ row, field: "simulation_url", code: "duplicate_in_file", value: `#${first}` });
            return;
          }
          seen.set(res.urlKey, row);
          rows.push({ row, urlKey: res.urlKey, record: res.record, auto: res.autoClassified });
        },
        onRowError: (row, message) => errs.push({ row, field: "*", code: "invalid_record", message }),
        onProgress: (fraction) => {
          setParseProgress(fraction);
          setDetected(rows.length + errs.length);
        },
      });
    } catch (e) {
      setPhase("idle");
      setFatal(format(t.import.parseError, { message: e instanceof Error ? e.message : String(e) }));
      return;
    }
    if (count === 0) {
      setPhase("idle");
      setFatal(t.import.empty);
      return;
    }
    prepared.current = rows;
    setDetected(count);
    setErrors(errs);
    setDupInFile(dups);

    // ---------------------------------------------------------------- 2. Trùng với DB
    setPhase("checking");
    const found = new Set<string>();
    try {
      for (let i = 0; i < rows.length; i += CHECK_CHUNK) {
        const keys = rows.slice(i, i + CHECK_CHUNK).map((r) => r.urlKey);
        const res = await apiFetch<{ existing: string[] }>("/api/admin/import/check", {
          method: "POST",
          json: { url_keys: keys },
        });
        res.existing.forEach((k) => found.add(k));
        setParseProgress(Math.min(1, (i + CHECK_CHUNK) / Math.max(rows.length, 1)));
      }
    } catch (e) {
      setFatal(errorMessage(e, t));
    }
    setExisting(found);
    setPhase("preview");
  };

  // ---------------------------------------------------------------- 3. Nhập theo lô
  const sendBatch = useCallback(
    async (index: number): Promise<boolean> => {
      const slice = toSend.current.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE);
      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled.current) return false;
        try {
          const res = await apiFetch<{
            inserted: number;
            updated: number;
            skipped: number;
            errors: { index: number; message: string }[];
          }>("/api/admin/import", {
            method: "POST",
            json: { job_id: jobId.current, on_duplicate: onDuplicate, records: slice.map((p) => p.record) },
          });
          setTotals((prev) => ({
            inserted: prev.inserted + res.inserted,
            updated: prev.updated + res.updated,
            skipped: prev.skipped + res.skipped,
            failed: prev.failed + res.errors.length,
          }));
          if (res.errors.length > 0) {
            setErrors((prev) => [
              ...prev,
              ...res.errors.map((e) => ({
                row: slice[e.index]?.row ?? 0,
                field: "*",
                code: "server" as const,
                message: e.message,
              })),
            ]);
          }
          return true;
        } catch (e) {
          const retryable = !(
            e instanceof Error &&
            "status" in e &&
            (e as { status: number }).status >= 400 &&
            (e as { status: number }).status < 500 &&
            (e as { status: number }).status !== 429
          );
          if (!retryable || attempt === 2) return false;
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        }
      }
      return false;
    },
    [onDuplicate],
  );

  const runBatches = useCallback(
    async (indexes: number[]) => {
      cancelled.current = false;
      setPhase("importing");
      const failed: number[] = [];
      let cursor = 0;
      const worker = async () => {
        while (cursor < indexes.length && !cancelled.current) {
          const idx = indexes[cursor++]!;
          const ok = await sendBatch(idx);
          if (!ok) failed.push(idx);
          setBatchesDone((d) => d + 1);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, indexes.length) }, worker));
      const remaining = cancelled.current ? indexes.slice(cursor) : [];
      const allFailed = [...failed, ...remaining].sort((a, b) => a - b);
      setFailedBatches(allFailed);
      const failedRecords = allFailed.reduce(
        (sum, i) => sum + Math.min(BATCH_SIZE, toSend.current.length - i * BATCH_SIZE),
        0,
      );
      if (jobId.current) {
        await apiFetch("/api/admin/import/jobs", {
          method: "PATCH",
          json: {
            id: jobId.current,
            status: cancelled.current
              ? "cancelled"
              : allFailed.length > 0
                ? "completed_with_errors"
                : "completed",
            extra_failed: failedRecords,
          },
        }).catch(() => undefined);
      }
      setPhase("done");
      router.refresh();
    },
    [sendBatch, router],
  );

  const startImport = async () => {
    const records = prepared.current
      .filter((p) => onDuplicate === "update" || !existing.has(p.urlKey))
      .map((p) => ({
        ...p,
        record: {
          ...p.record,
          is_demo: markDemo,
          status: p.auto && reviewAuto ? ("pending_review" as const) : p.record.status,
        },
      }));
    toSend.current = records;
    const count = Math.ceil(records.length / BATCH_SIZE);
    setBatchCount(count);
    setBatchesDone(0);
    setTotals({ inserted: 0, updated: 0, skipped: onDuplicate === "skip" ? existing.size : 0, failed: 0 });
    try {
      const job = await apiFetch<ImportJob>("/api/admin/import/jobs", {
        method: "POST",
        json: {
          file_name: fileInfo?.name ?? "import",
          format: fileInfo?.format ?? "json",
          on_duplicate: onDuplicate,
          total_records: detected,
        },
      });
      jobId.current = job.id;
    } catch {
      jobId.current = null; // vẫn cho phép import nếu không ghi được nhật ký
    }
    await runBatches(Array.from({ length: count }, (_, i) => i));
  };

  const retryFailed = async () => {
    const indexes = failedBatches;
    setFailedBatches([]);
    setBatchCount(indexes.length);
    setBatchesDone(0);
    await runBatches(indexes);
  };

  const downloadErrors = () => {
    const codes = t.import.errorCodes as Record<string, string>;
    downloadText(
      `import-errors-${Date.now()}.csv`,
      Papa.unparse(
        errors.map((e) => ({
          row: e.row,
          field: e.field,
          code: e.code,
          message: codes[e.code] ?? e.code,
          detail: e.message ?? e.value ?? "",
        })),
      ),
    );
  };

  const validCount = prepared.current.length;
  const importable = onDuplicate === "update" ? validCount : validCount - existing.size;
  const parseErrorCount = errors.filter((e) => e.code !== "server" && e.code !== "duplicate_in_file").length;

  // ---------------------------------------------------------------- Giao diện
  return (
    <div className="space-y-6">
      {fatal && (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
        >
          <AlertTriangle className="size-4" aria-hidden /> {fatal}
        </p>
      )}

      {phase === "idle" && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
            className={cn(
              "bg-card flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors",
              dragOver && "border-primary bg-primary-soft",
            )}
          >
            <FileUp className="text-primary size-10" aria-hidden />
            <p className="font-semibold">{t.import.dropzone}</p>
            <p className="text-muted-foreground text-sm">{t.import.dropzoneHint}</p>
            <input
              ref={fileInput}
              id="import-file"
              type="file"
              accept=".csv,.tsv,.json,.jsonl,.ndjson"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <Button asChild>
              <label htmlFor="import-file" className="cursor-pointer">
                <Upload /> {t.import.chooseFile}
              </label>
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="bg-card space-y-3 rounded-2xl border p-5 shadow-sm">
              <h2 className="font-semibold">{t.import.format}</h2>
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">{CSV_COLUMNS.join(",")}</pre>
              <p className="text-muted-foreground text-xs">+ {OPTIONAL_COLUMNS.join(", ")}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadText(
                    "simulations-template.csv",
                    buildCsvTemplate([...CSV_COLUMNS, ...OPTIONAL_COLUMNS]),
                  )
                }
              >
                <Download /> {t.import.downloadTemplate}
              </Button>
            </section>
            <section className="bg-card space-y-3 rounded-2xl border p-5 shadow-sm">
              <h2 className="font-semibold">{t.import.history}</h2>
              {history.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t.import.noHistory}</p>
              ) : (
                <ul className="divide-y text-sm">
                  {history.map((job) => (
                    <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="min-w-0 truncate font-medium">{job.file_name}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {formatDate(job.created_at, locale, { dateStyle: "short", timeStyle: "short" })} · +
                        {n(job.inserted)} · ↻{n(job.updated)} · ✕{n(job.failed)} ·{" "}
                        {(t.import.jobStatuses as Record<string, string>)[job.status] ?? job.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {(phase === "parsing" || phase === "checking") && (
        <div className="bg-card space-y-4 rounded-2xl border p-6 shadow-sm">
          <p className="flex items-center gap-2 font-medium">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {fileInfo?.name}
          </p>
          <ProgressBar
            value={parseProgress}
            label={phase === "parsing" ? t.import.parsing : t.import.checkingDuplicates}
          />
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {t.import.detected}: {n(detected)}
          </p>
        </div>
      )}

      {(phase === "preview" || phase === "importing" || phase === "done") && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={t.import.detected} value={n(detected)} sub={fileInfo?.name} />
            <Stat label={t.import.valid} value={n(validCount)} tone="success" />
            <Stat
              label={t.import.duplicates}
              value={n(dupInFile + existing.size)}
              tone="warning"
              sub={`${format(t.import.duplicatesInFile, { n: n(dupInFile) })} · ${format(t.import.duplicatesInDb, { n: n(existing.size) })}`}
            />
            <Stat
              label={t.import.errors}
              value={n(parseErrorCount)}
              tone={parseErrorCount > 0 ? "danger" : undefined}
            />
          </div>

          {phase === "preview" && (
            <div className="bg-card space-y-4 rounded-2xl border p-5 shadow-sm">
              {autoCount > 0 && (
                <p className="flex items-center gap-2 text-sm">
                  <Sparkles className="text-primary size-4" aria-hidden />{" "}
                  {format(t.import.autoClassified, { n: n(autoCount) })}
                </p>
              )}
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">{t.import.onDuplicate}</legend>
                <div className="flex flex-wrap gap-2">
                  {(["skip", "update"] as const).map((v) => (
                    <label
                      key={v}
                      className={cn(
                        "has-[:focus-visible]:outline-ring flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:outline-3",
                        onDuplicate === v && "border-primary bg-primary-soft text-primary",
                      )}
                    >
                      <input
                        type="radio"
                        name="dup"
                        value={v}
                        checked={onDuplicate === v}
                        onChange={() => setOnDuplicate(v)}
                        className="sr-only"
                      />
                      {v === "skip" ? t.import.onDuplicateSkip : t.import.onDuplicateUpdate}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="review-auto"
                  checked={reviewAuto}
                  onCheckedChange={(v) => setReviewAuto(v === true)}
                />
                <div>
                  <Label htmlFor="review-auto">{t.import.reviewAuto}</Label>
                  <p className="text-muted-foreground mt-1 text-xs">{t.import.reviewAutoHint}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="mark-demo"
                  checked={markDemo}
                  onCheckedChange={(v) => setMarkDemo(v === true)}
                />
                <Label htmlFor="mark-demo" className="leading-snug">
                  {t.import.markDemo}
                </Label>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="lg" onClick={() => void startImport()} disabled={importable <= 0}>
                  <Upload /> {format(t.import.importValid, { n: n(Math.max(importable, 0)) })}
                </Button>
                <Button size="lg" variant="outline" onClick={reset}>
                  {t.common.cancel}
                </Button>
              </div>
            </div>
          )}

          {(phase === "importing" || phase === "done") && (
            <div className="bg-card space-y-4 rounded-2xl border p-5 shadow-sm">
              {phase === "importing" ? (
                <>
                  <ProgressBar
                    value={batchCount ? batchesDone / batchCount : 1}
                    label={format(t.import.batches, { done: n(batchesDone), total: n(batchCount) })}
                  />
                  <Button variant="outline" onClick={() => (cancelled.current = true)}>
                    <Square /> {t.import.cancel}
                  </Button>
                </>
              ) : (
                <p className="flex items-center gap-2 font-semibold">
                  {failedBatches.length > 0 || totals.failed > 0 ? (
                    <AlertTriangle className="text-warning size-5" aria-hidden />
                  ) : (
                    <CheckCircle2 className="text-success size-5" aria-hidden />
                  )}
                  {cancelled.current
                    ? t.import.cancelled
                    : failedBatches.length > 0 || totals.failed > 0
                      ? t.import.completedWithErrors
                      : t.import.completed}
                </p>
              )}
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="polite">
                {(
                  [
                    [t.import.inserted, totals.inserted],
                    [t.import.updated, totals.updated],
                    [t.import.skipped, totals.skipped],
                    [t.import.failed, totals.failed],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="bg-muted rounded-xl p-3">
                    <dt className="text-muted-foreground text-xs">{label}</dt>
                    <dd className="text-xl font-bold tabular-nums">{n(value)}</dd>
                  </div>
                ))}
              </dl>
              {phase === "done" && (
                <div className="flex flex-wrap gap-2">
                  {failedBatches.length > 0 && (
                    <Button onClick={() => void retryFailed()}>
                      <RotateCcw /> {t.import.retryFailed} (
                      {format(t.import.failedBatches, { n: n(failedBatches.length) })})
                    </Button>
                  )}
                  <Button variant="outline" onClick={reset}>
                    <Copy /> {t.import.newImport}
                  </Button>
                </div>
              )}
            </div>
          )}

          {errors.length > 0 && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  {t.import.errorList} ({n(errors.length)})
                </h2>
                <Button variant="outline" size="sm" onClick={downloadErrors}>
                  <Download /> {t.import.downloadErrors}
                </Button>
              </div>
              <ErrorList errors={errors} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
