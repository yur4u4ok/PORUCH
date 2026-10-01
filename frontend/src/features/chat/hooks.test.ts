import { describe, expect, it } from "vitest";

import type { Message } from "@/types/api";

import { markMessagesRead, upsertMessage, type MessagesData } from "./hooks";

const msg = (over: Partial<Message>): Message => ({
  id: "1",
  conversation_id: "c",
  sender_id: "u",
  text: "hi",
  message_type: "TEXT",
  attachment: null,
  client_id: null,
  created_at: "2026-10-01T12:00:00Z",
  read_at: null,
  ...over,
});

const data = (messages: Message[]): MessagesData => ({
  pages: [{ next: null, previous: null, results: messages }],
  pageParams: [null],
});

describe("message cache helpers", () => {
  it("prepends new messages", () => {
    const result = upsertMessage(data([msg({ id: "1" })]), msg({ id: "2" }));
    expect(result!.pages[0]!.results.map((m) => m.id)).toEqual(["2", "1"]);
  });

  it("replaces optimistic message by client_id (no duplicates)", () => {
    const optimistic = msg({ id: "local-x", client_id: "x", pending: true });
    const server = msg({ id: "srv", client_id: "x" });
    const result = upsertMessage(data([optimistic]), server);
    expect(result!.pages[0]!.results).toHaveLength(1);
    expect(result!.pages[0]!.results[0]).toMatchObject({ id: "srv", pending: false });
  });

  it("ignores duplicate websocket delivery", () => {
    const once = upsertMessage(data([]), msg({ id: "a" }));
    const twice = upsertMessage(once, msg({ id: "a" }));
    expect(twice!.pages[0]!.results).toHaveLength(1);
  });

  it("marks messages read", () => {
    const result = markMessagesRead(
      data([msg({ id: "a" }), msg({ id: "b" })]),
      ["a"],
      "2026-10-01T13:00:00Z",
    );
    expect(result!.pages[0]!.results.map((m) => m.read_at)).toEqual(["2026-10-01T13:00:00Z", null]);
  });
});
