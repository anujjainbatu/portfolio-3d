import { buildSystemPrompt } from "./chatPolicy.js";
import {
  CHAT_LIMITS,
  validateChatPayload,
  type ChatTurn,
} from "./chatValidation.js";
import {
  ProviderConfigurationError,
  ProviderResponseError,
  requestGroqAnswer,
} from "./groq.js";
import {
  checkChatRateLimit,
  RateLimitConfigurationError,
  type RateLimitResult,
} from "./rateLimit.js";

type HeaderValue = string | string[] | undefined;

export interface ChatRequest {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
  socket?: { remoteAddress?: string };
}

export interface ChatResponse {
  statusCode: number;
  setHeader(name: string, value: string | number): void;
  end(body?: string): void;
}

interface HandlerDependencies {
  answer(messages: ChatTurn[], systemPrompt: string): Promise<string>;
  rateLimit(ipAddress: string): Promise<RateLimitResult>;
}

const getHeader = (headers: ChatRequest["headers"], name: string): string => {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : value || "";
};

const getClientIp = (request: ChatRequest): string => {
  const forwarded = getHeader(request.headers, "x-forwarded-for");
  return forwarded.split(",")[0]?.trim() ||
    getHeader(request.headers, "x-real-ip") ||
    request.socket?.remoteAddress ||
    "unknown";
};

const hasAllowedOrigin = (request: ChatRequest): boolean => {
  const origin = getHeader(request.headers, "origin");
  if (!origin) return false;

  const host =
    getHeader(request.headers, "x-forwarded-host") ||
    getHeader(request.headers, "host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

const sendJson = (
  response: ChatResponse,
  status: number,
  body: unknown,
) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
};

const sendError = (
  response: ChatResponse,
  status: number,
  code: string,
  message: string,
) => sendJson(response, status, { error: { code, message } });

export function createChatHandler(
  dependencies: HandlerDependencies = {
    answer: requestGroqAnswer,
    rateLimit: checkChatRateLimit,
  },
) {
  return async function chatHandler(request: ChatRequest, response: ChatResponse) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");

    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return sendError(response, 405, "method_not_allowed", "Use POST for chat requests.");
    }

    if (!hasAllowedOrigin(request)) {
      return sendError(response, 400, "invalid_origin", "This request origin is not allowed.");
    }

    const contentLength = Number(getHeader(request.headers, "content-length") || 0);
    if (contentLength > CHAT_LIMITS.maxPayloadBytes) {
      return sendError(response, 400, "payload_too_large", "The chat request is too large.");
    }

    const validation = validateChatPayload(request.body);
    if (!validation.ok) {
      return sendError(response, 400, "invalid_request", validation.message);
    }

    try {
      const rateLimit = await dependencies.rateLimit(getClientIp(request));
      if (!rateLimit.allowed) {
        response.setHeader("Retry-After", rateLimit.retryAfterSeconds);
        return sendError(
          response,
          429,
          "rate_limited",
          "Too many questions from this connection. Please try again shortly.",
        );
      }
    } catch (error) {
      if (error instanceof RateLimitConfigurationError) {
        return sendError(
          response,
          503,
          "rate_limit_not_configured",
          "The assistant rate limiter is not configured on this deployment.",
        );
      }
      return sendError(
        response,
        503,
        "rate_limit_unavailable",
        "The assistant is temporarily unavailable.",
      );
    }

    try {
      const message = await dependencies.answer(
        validation.messages,
        buildSystemPrompt(),
      );
      // The site carries no em dashes; the prompt asks for none, and this
      // catches any the model writes anyway.
      return sendJson(response, 200, {
        message: message.replace(/\s*—\s*/g, ", "),
      });
    } catch (error) {
      if (error instanceof ProviderConfigurationError) {
        return sendError(
          response,
          503,
          "assistant_unavailable",
          "The assistant is not configured on this deployment.",
        );
      }

      if (error instanceof ProviderResponseError) {
        return sendError(
          response,
          502,
          "provider_error",
          "The assistant could not answer right now.",
        );
      }

      return sendError(
        response,
        502,
        "provider_error",
        "The assistant could not answer right now.",
      );
    }
  };
}
