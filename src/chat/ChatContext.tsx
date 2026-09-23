import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { track } from "@vercel/analytics";
import { capConversation, readConversation, writeConversation } from "./chatStorage";
import type { ChatErrorState, ChatMessage, ChatStatus } from "./chatTypes";

interface ChatContextValue {
  isOpen: boolean;
  messages: ChatMessage[];
  status: ChatStatus;
  error: ChatErrorState | null;
  openChat(): void;
  closeChat(): void;
  sendQuestion(question: string): Promise<void>;
  retry(): Promise<void>;
  regenerate(): Promise<void>;
  stop(): void;
  clearConversation(): void;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

interface ApiSuccessBody {
  message?: string;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const trackChatEvent = (
  name: string,
  properties?: Record<string, string>,
) => {
  if (import.meta.env.PROD) track(name, properties);
};

const createMessage = (role: ChatMessage["role"], content: string): ChatMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  role,
  content,
  createdAt: Date.now(),
});

const dispatchMascotReaction = (reaction: "open" | "answer") => {
  window.dispatchEvent(
    new CustomEvent("portfolio:chat-reaction", { detail: { reaction } }),
  );
};

const parseRetryAfter = (response: Response): number => {
  const value = Number(response.headers.get("Retry-After"));
  return Number.isFinite(value) && value > 0 ? value : 60;
};

export const ChatProvider = ({ children }: PropsWithChildren) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    typeof window === "undefined" ? [] : readConversation(window.sessionStorage),
  );
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<ChatErrorState | null>(null);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    writeConversation(window.sessionStorage, messages);
  }, [messages]);

  useEffect(
    () => () => {
      abortController.current?.abort();
    },
    [],
  );

  const requestAnswer = useCallback(async (history: ChatMessage[]) => {
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    setStatus("sending");
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: capConversation(history).map(({ role, content }) => ({
            role,
            content,
          })),
        }),
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => ({}))) as
        | ApiSuccessBody
        | ApiErrorBody;

      if (!response.ok) {
        const apiError = (data as ApiErrorBody).error;
        if (response.status === 429) {
          const retryAfterSeconds = parseRetryAfter(response);
          setStatus("rate-limited");
          setError({
            status: "rate-limited",
            message:
              apiError?.message || "Too many questions. Please try again shortly.",
            retryAfterSeconds,
          });
          trackChatEvent("portfolio_chat_rate_limited");
          return;
        }

        if (response.status === 503) {
          setStatus("offline");
          setError({
            status: "offline",
            message:
              apiError?.message ||
              "The assistant is temporarily offline. The rest of the portfolio still works.",
          });
          trackChatEvent("portfolio_chat_failed", { reason: "offline" });
          return;
        }

        throw new Error(apiError?.message || "The assistant could not answer.");
      }

      const answer = (data as ApiSuccessBody).message?.trim();
      if (!answer) throw new Error("The assistant returned an empty answer.");

      setMessages((current) =>
        capConversation([...current, createMessage("assistant", answer)]),
      );
      setStatus("idle");
      dispatchMascotReaction("answer");
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        return;
      }
      setStatus("error");
      setError({
        status: "error",
        message: "That did not go through. Check the connection and try again.",
      });
      trackChatEvent("portfolio_chat_failed", { reason: "request" });
    } finally {
      if (abortController.current === controller) abortController.current = null;
    }
  }, []);

  const sendQuestion = useCallback(
    async (question: string) => {
      const content = question.trim();
      if (!content || status === "sending") return;

      const nextMessages = capConversation([
        ...messages,
        createMessage("user", content.slice(0, 1_500)),
      ]);
      setMessages(nextMessages);
      trackChatEvent("portfolio_chat_question_submitted");
      await requestAnswer(nextMessages);
    },
    [messages, requestAnswer, status],
  );

  const retry = useCallback(async () => {
    if (status === "sending" || messages.at(-1)?.role !== "user") return;
    trackChatEvent("portfolio_chat_retry");
    await requestAnswer(messages);
  }, [messages, requestAnswer, status]);

  const regenerate = useCallback(async () => {
    if (status === "sending" || messages.at(-1)?.role !== "assistant") return;
    const history = messages.slice(0, -1);
    if (history.length === 0) return;
    setMessages(history);
    trackChatEvent("portfolio_chat_regenerated");
    await requestAnswer(history);
  }, [messages, requestAnswer, status]);

  const stop = useCallback(() => {
    if (status !== "sending") return;
    abortController.current?.abort();
    abortController.current = null;
    setStatus("idle");
    setError(null);
    trackChatEvent("portfolio_chat_stopped");
  }, [status]);

  const openChat = useCallback(() => {
    setIsOpen(true);
    trackChatEvent("portfolio_chat_opened");
    dispatchMascotReaction("open");
  }, []);

  const closeChat = useCallback(() => setIsOpen(false), []);

  const clearConversation = useCallback(() => {
    abortController.current?.abort();
    setMessages([]);
    setStatus("idle");
    setError(null);
    trackChatEvent("portfolio_chat_cleared");
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      isOpen,
      messages,
      status,
      error,
      openChat,
      closeChat,
      sendQuestion,
      retry,
      regenerate,
      stop,
      clearConversation,
    }),
    [
      clearConversation,
      closeChat,
      error,
      isOpen,
      messages,
      openChat,
      regenerate,
      retry,
      sendQuestion,
      status,
      stop,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

// The provider and hook intentionally share a module to keep the chat state API local.
// eslint-disable-next-line react-refresh/only-export-components
export const useChat = (): ChatContextValue => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used inside ChatProvider.");
  return context;
};
