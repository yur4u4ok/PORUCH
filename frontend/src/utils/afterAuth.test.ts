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
