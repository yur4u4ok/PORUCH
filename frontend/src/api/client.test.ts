import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { jsonResponse } from "@/test/utils";

import { ApiError, onUnauthorized, request } from "./client";

describe("api client", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "csrftoken=abc123";
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("sends credentials and CSRF header for unsafe requests", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await request("/help-requests/", { method: "POST", body: { a: 1 } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/help-requests/");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-CSRFToken"]).toBe("abc123");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("builds query strings and skips empty values", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await request("/help-requests/", { query: { lat: 49.8, lng: 24, category: undefined, status: "" } });
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/v1/help-requests/?lat=49.8&lng=24");
  });

  it("maps error bodies to ApiError with field errors", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { code: "VALIDATION_ERROR", message: "Invalid request", details: { description: ["Too long"] } },
        400,
      ),
    );
    const error = await request<never>("/x/", { method: "POST", body: {} }).catch((e: ApiError) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.fieldErrors()).toEqual({ description: "Too long" });
  });

  it("refreshes the session once on 401 and retries", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: "AUTHENTICATION_FAILED" }, 401))
      .mockResolvedValueOnce(jsonResponse(null, 204)) // refresh
      .mockResolvedValueOnce(jsonResponse({ id: "me" }));
    await expect(request<{ id: string }>("/me/")).resolves.toEqual({ id: "me" });
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/v1/auth/refresh/");
  });

  it("notifies listeners when refresh fails", async () => {
    const listener = vi.fn();
    const off = onUnauthorized(listener);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: "NOT_AUTHENTICATED" }, 401))
      .mockResolvedValueOnce(jsonResponse({ code: "NOT_AUTHENTICATED" }, 401));
    await expect(request("/me/")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledOnce();
    off();
  });

  it("reports network failures", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const error = await request<never>("/me/", { skipRefresh: true }).catch((e: ApiError) => e);
    expect(error.code).toBe("NETWORK_ERROR");
  });
});
