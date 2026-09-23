import { describe, expect, it } from "vitest";
import {
  CHAT_STORAGE_KEY,
  MAX_STORED_MESSAGES,
  capConversation,
  readConversation,
  writeConversation,
} from "../src/chat/chatStorage";
import type { ChatMessage } from "../src/chat/chatTypes";

const makeMessage = (index: number): ChatMessage => ({
  id: String(index),
  role: index % 2 ? "assistant" : "user",
  content: `message ${index}`,
  createdAt: index,
});

describe("chat session storage", () => {
  it("keeps only the latest twelve messages", () => {
    const messages = Array.from({ length: 16 }, (_, index) => makeMessage(index));
    expect(capConversation(messages)).toHaveLength(MAX_STORED_MESSAGES);
    expect(capConversation(messages)[0].id).toBe("4");
  });

  it("round-trips valid session data and clears empty history", () => {
    const messages = [makeMessage(0), makeMessage(1)];
    writeConversation(window.sessionStorage, messages);
    expect(readConversation(window.sessionStorage)).toEqual(messages);

    writeConversation(window.sessionStorage, []);
    expect(window.sessionStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });

  it("ignores corrupt or outdated data", () => {
    window.sessionStorage.setItem(CHAT_STORAGE_KEY, "not json");
    expect(readConversation(window.sessionStorage)).toEqual([]);

    window.sessionStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({ version: 2, messages: [makeMessage(0)] }),
    );
    expect(readConversation(window.sessionStorage)).toEqual([]);
  });
});

