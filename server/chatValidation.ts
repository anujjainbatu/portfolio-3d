export const CHAT_LIMITS = {
  maxMessages: 12,
  maxMessageCharacters: 1_500,
  maxTotalCharacters: 8_000,
  maxPayloadBytes: 32_000,
} as const;

export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export type ValidationResult =
  | { ok: true; messages: ChatTurn[] }
  | { ok: false; message: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function validateChatPayload(body: unknown): ValidationResult {
  if (!isObject(body) || !Array.isArray(body.messages)) {
    return { ok: false, message: "Messages must be an array." };
  }

  if (Object.keys(body).some((key) => key !== "messages")) {
    return { ok: false, message: "Only the messages field is accepted." };
  }

  if (body.messages.length === 0) {
    return { ok: false, message: "At least one message is required." };
  }

  if (body.messages.length > CHAT_LIMITS.maxMessages) {
    return {
      ok: false,
      message: `A conversation can contain at most ${CHAT_LIMITS.maxMessages} messages.`,
    };
  }

  const messages: ChatTurn[] = [];
  let totalCharacters = 0;

  for (const value of body.messages) {
    if (!isObject(value)) {
      return { ok: false, message: "Every message must be an object." };
    }

    if (Object.keys(value).some((key) => key !== "role" && key !== "content")) {
      return { ok: false, message: "Messages may only contain role and content." };
    }

    if (value.role !== "user" && value.role !== "assistant") {
      return {
        ok: false,
        message: "Only user and assistant message roles are accepted.",
      };
    }

    if (typeof value.content !== "string") {
      return { ok: false, message: "Every message needs text content." };
    }

    const content = value.content.trim();
    if (!content) {
      return { ok: false, message: "Messages cannot be empty." };
    }

    if (content.length > CHAT_LIMITS.maxMessageCharacters) {
      return {
        ok: false,
        message: `Each message is limited to ${CHAT_LIMITS.maxMessageCharacters} characters.`,
      };
    }

    totalCharacters += content.length;
    if (totalCharacters > CHAT_LIMITS.maxTotalCharacters) {
      return {
        ok: false,
        message: `Conversation text is limited to ${CHAT_LIMITS.maxTotalCharacters} characters.`,
      };
    }

    messages.push({ role: value.role, content });
  }

  if (messages.at(-1)?.role !== "user") {
    return { ok: false, message: "The final message must come from the user." };
  }

  return { ok: true, messages };
}
