import { expect, it } from "vitest";

import { consumeAfterAuth, peekAfterAuth, rememberAfterAuth } from "./afterAuth";

it("returns to the remembered page once, and only to local paths", () => {
  rememberAfterAuth("/help/abc");
  expect(peekAfterAuth()).toBe("/help/abc");
  expect(consumeAfterAuth()).toBe("/help/abc");
  expect(consumeAfterAuth()).toBe("/");
  rememberAfterAuth("//evil.example.com");
  expect(consumeAfterAuth()).toBe("/");
});

it("survives a new tab (email link) but not a day later", () => {
  rememberAfterAuth("/nearby");
  expect(peekAfterAuth()).toBe("/nearby"); // stored in localStorage, shared between tabs
  localStorage.setItem(
    "poruch.afterAuth",
    JSON.stringify({ path: "/nearby", at: Date.now() - 25 * 3600_000 }),
  );
  expect(consumeAfterAuth()).toBe("/");
});
