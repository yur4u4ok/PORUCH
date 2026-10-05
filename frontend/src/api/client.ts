/**
 * Single HTTP client for the REST API. Components never call fetch directly —
 * they use feature hooks built on top of the api/* modules.
 *
 * Auth uses HttpOnly cookies (no tokens in JS). Unsafe requests send the CSRF token
 * read from the non-HttpOnly `csrftoken` cookie. A 401 triggers one refresh attempt.
 */
import type { ApiErrorBody } from "@/types/api";

export const API_BASE = "/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.message || `HTTP ${status}`);
    this.status = status;
    this.code = body.code || (status === 0 ? "NETWORK_ERROR" : "ERROR");
    this.details = body.details || {};
  }

  /** Field errors as { field: "first message" } for inline form errors. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.details)) {
      if (Array.isArray(value) && value.length) out[key] = String(value[0]);
      else if (typeof value === "string") out[key] = value;
    }
    return out;
  }
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function getCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

let csrfPromise: Promise<void> | null = null;
async function ensureCsrf(): Promise<void> {
  if (getCookie("csrftoken")) return;
  csrfPromise ??= fetch(`${API_BASE}/auth/csrf/`, { credentials: "include" }).then(() => undefined);
  await csrfPromise;
  csrfPromise = null;
}

let refreshPromise: Promise<boolean> | null = null;
/** Single-flight refresh: concurrent 401s share one refresh request. */
export async function refreshSession(): Promise<boolean> {
  refreshPromise ??= (async () => {
    try {
      await ensureCsrf();
      const res = await fetch(`${API_BASE}/auth/refresh/`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": getCookie("csrftoken") ?? "" },
      });
      return res.ok;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** do not try to refresh the session on 401 */
  skipRefresh?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = path.startsWith("http") || path.startsWith("/api") ? path : `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const unsafe = method !== "GET";
  if (unsafe) await ensureCsrf();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (unsafe) headers["X-CSRFToken"] = getCookie("csrftoken") ?? "";

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: "include",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, { message: "Network error" });
  }

  if (response.status === 401) {
    if (!options.skipRefresh && (await refreshSession()))
      return request<T>(path, { ...options, skipRefresh: true });
    // Session is gone for good: let the app drop the cached user.
    unauthorizedListeners.forEach((listener) => listener());
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const data = text ? safeJson(text) : undefined;
  if (!response.ok) throw new ApiError(response.status, (data as ApiErrorBody) ?? {});
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export const http = {
  get: <T>(path: string, query?: RequestOptions["query"], signal?: AbortSignal) =>
    request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};
