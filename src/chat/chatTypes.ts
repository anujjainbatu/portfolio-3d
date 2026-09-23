export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

export type ChatStatus = "idle" | "sending" | "error" | "offline" | "rate-limited";

export interface ChatErrorState {
  status: Exclude<ChatStatus, "idle" | "sending">;
  message: string;
  retryAfterSeconds?: number;
}

