/**
 * Đọc tệp import ngay trên trình duyệt theo luồng (không tải toàn bộ lên server).
 * CSV: PapaParse streaming · JSONL: đọc từng dòng · JSON: mảng hoặc { "simulations": [...] }.
 */
import Papa from "papaparse";

export type ImportFormat = "csv" | "json" | "jsonl";

export const MAX_IMPORT_BYTES = 200 * 1024 * 1024;

export function detectFormat(fileName: string): ImportFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return "csv";
  if (lower.endsWith(".jsonl") || lower.endsWith(".ndjson")) return "jsonl";
  if (lower.endsWith(".json")) return "json";
  return null;
}

export interface ParseCallbacks {
  /** Được gọi cho mỗi bản ghi thô; row bắt đầu từ 1 (CSV: không tính dòng tiêu đề). */
  onRecord: (raw: Record<string, unknown>, row: number) => void;
  onRowError: (row: number, message: string) => void;
  onProgress: (fraction: number) => void;
}

const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function parseImportFile(file: File, format: ImportFormat, cb: ParseCallbacks): Promise<number> {
  if (format === "csv") return parseCsv(file, cb);
  if (format === "jsonl") return parseJsonl(file, cb);
  return parseJson(file, cb);
}

function parseCsv(file: File, cb: ParseCallbacks): Promise<number> {
  return new Promise((resolve, reject) => {
    let row = 0;
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      chunkSize: 1024 * 1024,
      chunk: (results, parser) => {
        parser.pause();
        for (const record of results.data) {
          row += 1;
          cb.onRecord(record, row);
        }
        for (const err of results.errors) {
          if (typeof err.row === "number") cb.onRowError(err.row + 1, err.message);
        }
        const cursor = (results.meta as { cursor?: number }).cursor ?? 0;
        cb.onProgress(Math.min(1, cursor / Math.max(file.size, 1)));
        void yieldToBrowser().then(() => parser.resume());
      },
      complete: () => resolve(row),
      error: (err) => reject(err),
    });
  });
}

async function parseJsonl(file: File, cb: ParseCallbacks): Promise<number> {
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let row = 0;
  let read = 0;
  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    row += 1;
    try {
      cb.onRecord(JSON.parse(trimmed) as Record<string, unknown>, row);
    } catch (e) {
      cb.onRowError(row, e instanceof Error ? e.message : "invalid JSON");
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    read += value.byteLength;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line);
    cb.onProgress(Math.min(1, read / Math.max(file.size, 1)));
    await yieldToBrowser();
  }
  buffer += decoder.decode();
  if (buffer) handleLine(buffer);
  return row;
}

async function parseJson(file: File, cb: ParseCallbacks): Promise<number> {
  const text = await file.text();
  const parsed: unknown = JSON.parse(text);
  const records = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { simulations?: unknown }).simulations)
      ? (parsed as { simulations: unknown[] }).simulations
      : null;
  if (!records) throw new Error('JSON phải là một mảng hoặc có dạng { "simulations": [...] }');
  for (let i = 0; i < records.length; i++) {
    cb.onRecord(records[i] as Record<string, unknown>, i + 1);
    if (i % 2000 === 1999) {
      cb.onProgress((i + 1) / records.length);
      await yieldToBrowser();
    }
  }
  cb.onProgress(1);
  return records.length;
}

export function buildCsvTemplate(columns: readonly string[]) {
  const example = {
    title: "Circuit Construction Kit: DC",
    description:
      "Lắp mạch điện một chiều với pin, bóng đèn, điện trở; đo hiệu điện thế và cường độ dòng điện.",
    subject: "Physics",
    grade_min: "7",
    grade_max: "12",
    topic: "Điện học",
    source_name: "PhET",
    source_url: "https://phet.colorado.edu/en/simulations/circuit-construction-kit-dc",
    simulation_url:
      "https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc_all.html",
    embed_url:
      "https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc_all.html",
    language: "multi",
    license: "CC BY 4.0",
    tags: "mạch điện, circuit, ohm",
  } as Record<string, string>;
  return Papa.unparse({ fields: [...columns], data: [columns.map((c) => example[c] ?? "")] });
}
