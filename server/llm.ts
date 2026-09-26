import type { ChatTurn } from "./chatValidation.js";
import { isConfiguredValue } from "./environment.js";

const REQUEST_TIMEOUT_MS = 15_000;
// Free tiers allow only a few thousand tokens per minute, and the system
// prompt alone is ~3K of them, so back-to-back questions routinely hit a 429
// that clears within seconds. The last provider in the chain waits that out
// server-side when it is short; earlier ones hand straight over to the next.
const MAX_RATE_LIMIT_WAIT_MS = 10_000;
const MAX_ATTEMPTS = 3;

export class ProviderConfigurationError extends Error {}
export class ProviderResponseError extends Error {}
export class ProviderRateLimitError extends ProviderResponseError {
  constructor(readonly retryAfterSeconds: number) {
    super("Provider rate limit reached.");
  }
}

interface Provider {
  name: string;
  url: string;
  apiKey: string | undefined;
  model: string;
  extraBody?: Record<string, unknown>;
}

interface CompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

const readEnv = (name: string) =>
  process.env[name]?.trim().replace(/^(["'])(.*)\1$/, "$2");

// Both providers speak the OpenAI chat-completions format. Gemini is first
// for its larger free quota; Groq covers Gemini's 503s and quota exhaustion.
const getProviders = (): Provider[] => [
  {
    name: "Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    apiKey: readEnv("GEMINI_API_KEY"),
    model: readEnv("GEMINI_MODEL") || "gemini-2.5-flash",
    // Thinking would spend the 400-token answer budget and add seconds.
    extraBody: { reasoning_effort: "none" },
  },
  {
    name: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    apiKey: readEnv("GROQ_API_KEY"),
    model: readEnv("GROQ_MODEL") || "openai/gpt-oss-20b",
  },
];

// Providers send Retry-After in seconds, and Groq sends
// x-ratelimit-reset-tokens as a Go duration such as "577ms" or "1m26.4s".
const parseDurationMs = (value: string | null | undefined): number | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed) * 1_000;
  const units: Record<string, number> = { h: 3_600_000, m: 60_000, s: 1_000, ms: 1 };
  let total = 0;
  let matched = false;
  for (const [, amount, unit] of trimmed.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) {
    total += Number(amount) * units[unit];
    matched = true;
  }
  return matched ? total : undefined;
};

const getRetryDelayMs = (response: Response): number =>
  parseDurationMs(response.headers?.get("retry-after")) ??
  parseDurationMs(response.headers?.get("x-ratelimit-reset-tokens")) ??
  5_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function requestAnswer(
  messages: ChatTurn[],
  systemPrompt: string,
): Promise<string> {
  const providers = getProviders().filter((provider) =>
    isConfiguredValue(provider.apiKey),
  );
  if (providers.length === 0) {
    throw new ProviderConfigurationError("No chat provider API key is configured.");
  }

  let lastError: ProviderResponseError | undefined;
  let rateLimited: ProviderRateLimitError | undefined;

  for (const [index, provider] of providers.entries()) {
    const isLast = index === providers.length - 1;
    try {
      return await requestProviderAnswer(provider, messages, systemPrompt, isLast);
    } catch (error) {
      if (!(error instanceof ProviderResponseError)) throw error;
      console.warn("portfolio_chat_provider_failed", {
        provider: provider.name,
        message: error.message,
      });
      lastError = error;
      if (error instanceof ProviderRateLimitError) {
        rateLimited =
          !rateLimited || error.retryAfterSeconds < rateLimited.retryAfterSeconds
            ? error
            : rateLimited;
      }
    }
  }

  // A rate limit tells the visitor when to come back; prefer it over a
  // generic failure from another provider.
  throw rateLimited ?? lastError!;
}

async function requestProviderAnswer(
  provider: Provider,
  messages: ChatTurn[],
  systemPrompt: string,
  waitOnRateLimit: boolean,
): Promise<string> {
  const body = JSON.stringify({
    model: provider.model,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.25,
    max_tokens: 400,
    ...provider.extraBody,
  });
  let waitedMs = 0;

  for (let attempt = 1; ; attempt += 1) {
    const response = await sendRequest(provider, body);

    if (response.status === 429) {
      const delayMs = getRetryDelayMs(response);
      if (
        waitOnRateLimit &&
        attempt < MAX_ATTEMPTS &&
        waitedMs + delayMs <= MAX_RATE_LIMIT_WAIT_MS
      ) {
        waitedMs += delayMs;
        await wait(delayMs);
        continue;
      }
      throw new ProviderRateLimitError(Math.max(1, Math.ceil(delayMs / 1_000)));
    }

    if (!response.ok) {
      throw new ProviderResponseError(`${provider.name} returned ${response.status}.`);
    }

    const data = (await response.json().catch(() => ({}))) as CompletionResponse;
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new ProviderResponseError(`${provider.name} returned an empty response.`);
    }

    return answer;
  }
}

async function sendRequest(provider: Provider, body: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(provider.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      signal: controller.signal,
    });
  } catch {
    throw new ProviderResponseError(`${provider.name} request failed.`);
  } finally {
    clearTimeout(timeout);
  }
}
