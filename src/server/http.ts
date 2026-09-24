import "server-only";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
}

/** Chuyển lỗi Supabase/PostgREST thành HttpError có mã thân thiện. */
export function toHttpError(error: PostgrestLikeError | null | undefined): HttpError {
  const code = error?.code ?? "";
  if (code === "57014") return new HttpError(503, "timeout");
  if (code === "42501" || code === "PGRST301") return new HttpError(403, "forbidden");
  if (code === "23505") return new HttpError(409, "conflict", error?.message);
  if (code === "23503" || code === "23514" || code === "22P02" || code === "22023") {
    return new HttpError(400, "invalid_input", error?.message);
  }
  if (code === "PGRST116") return new HttpError(404, "not_found");
  return new HttpError(500, "server_error", error?.message);
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    if (err.status >= 500) console.error("[api]", err.code, err.message);
    return NextResponse.json(
      { error: err.code, message: err.status < 500 ? err.message : undefined },
      { status: err.status },
    );
  }
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as ZodError).issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return NextResponse.json({ error: "invalid_input", issues }, { status: 400 });
  }
  console.error("[api] unexpected", err);
  return NextResponse.json({ error: "server_error" }, { status: 500 });
}

/** Bao handler để mọi lỗi đều trả JSON nhất quán (không crash route). */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson(request: Request, maxBytes = 1_000_000): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new HttpError(413, "payload_too_large");
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

// ---------------------------------------------------------------------------
// Giới hạn tần suất đơn giản theo IP (best-effort, trong bộ nhớ của từng instance).
// ---------------------------------------------------------------------------
const buckets = new Map<string, { count: number; reset: number }>();

export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function rateLimit(request: Request, scope: string, limit: number, windowMs: number) {
  const key = `${scope}:${clientIp(request)}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
    }
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) throw new HttpError(429, "rate_limited");
}
