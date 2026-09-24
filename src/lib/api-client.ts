"use client";

import type { Dictionary } from "@/lib/i18n/dictionaries";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public issues?: { path: string; message: string }[],
  ) {
    super(message ?? code);
  }
}

/** fetch JSON với xử lý lỗi thống nhất (không bao giờ ném lỗi không rõ ràng ra UI). */
export async function apiFetch<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "network");
  }
  if (res.status === 204) return undefined as T;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // phản hồi không phải JSON
  }
  if (!res.ok) {
    const b = (body ?? {}) as {
      error?: string;
      message?: string;
      issues?: { path: string; message: string }[];
    };
    throw new ApiError(res.status, b.error ?? "server_error", b.message, b.issues);
  }
  return body as T;
}

/** Thông báo lỗi thân thiện theo ngôn ngữ hiện tại. */
export function errorMessage(err: unknown, t: Dictionary): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "network":
        return t.errors.network;
      case "unauthorized":
        return t.auth.loginRequired;
      case "forbidden":
        return t.errors.forbidden;
      case "rate_limited":
        return t.errors.rateLimited;
      case "timeout":
        return t.errors.timeout;
      case "invalid_input":
      case "conflict":
      case "duplicate_url":
        return err.message && err.message !== err.code ? err.message : t.errors.invalidInput;
      default:
        return t.errors.generic;
    }
  }
  return t.errors.generic;
}
