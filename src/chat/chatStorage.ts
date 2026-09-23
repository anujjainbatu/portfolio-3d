import type { ChatMessage } from "./chatTypes";

export const CHAT_STORAGE_KEY = "portfolio-chat:v1";
export const MAX_STORED_MESSAGES = 12;

interface StoredConversation {
  version: 1;
  messages: ChatMessage[];
}

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.length > 0 &&
    message.content.length <= 1_500 &&
    typeof message.createdAt === "number"
  );
};

export const capConversation = (messages: ChatMessage[]): ChatMessage[] =>
  messages.slice(-MAX_STORED_MESSAGES);

export function readConversation(storage: Pick<Storage, "getItem">): ChatMessage[] {
  try {
    const raw = storage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredConversation>;
    if (parsed.version !== 1 || !Array.isArray(parsed.messages)) return [];
    return capConversation(parsed.messages.filter(isChatMessage));
  } catch {
    return [];
  }
}

export function writeConversation(
  storage: Pick<Storage, "setItem" | "removeItem">,
  messages: ChatMessage[],
) {
  try {
    if (messages.length === 0) {
      storage.removeItem(CHAT_STORAGE_KEY);
      return;
    }

    const value: StoredConversation = {
      version: 1,
      messages: capConversation(messages),
    };
    storage.setItem(CHAT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // A blocked/full sessionStorage must never make the portfolio unusable.
  }
}

