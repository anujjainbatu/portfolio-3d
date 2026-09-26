import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProviderConfigurationError,
  ProviderRateLimitError,
  ProviderResponseError,
  requestAnswer,
} from "../server/llm";

const ENV_KEYS = ["GEMINI_API_KEY", "GEMINI_MODEL", "GROQ_API_KEY", "GROQ_MODEL"];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

const answer = (content: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
});

const rateLimited = (headers: Record<string, string> = {}) => ({
  ok: false,
  status: 429,
  headers: new Headers(headers),
});

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("chat provider chain", () => {
  it("fails safely when no API key is configured", async () => {
    await expect(requestAnswer([], "server policy")).rejects.toBeInstanceOf(
      ProviderConfigurationError,
    );
  });

  it("keeps policy server-owned and caps the Gemini request", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GEMINI_MODEL = "test-model";
    const fetchMock = vi.fn().mockResolvedValue(answer("  Approved answer  "));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestAnswer([{ role: "user", content: "What has Anuj built?" }], "server policy"),
    ).resolves.toBe("Approved answer");

    expect(fetchMock.mock.calls[0][0]).toContain("generativelanguage.googleapis.com");
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request).toMatchObject({
      model: "test-model",
      temperature: 0.25,
      max_tokens: 400,
      reasoning_effort: "none",
      messages: [
        { role: "system", content: "server policy" },
        { role: "user", content: "What has Anuj built?" },
      ],
    });
  });

  it("falls back to Groq immediately when Gemini is rate limited", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GROQ_API_KEY = "groq-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited({ "retry-after": "5" }))
      .mockResolvedValueOnce(answer("From Groq"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestAnswer([], "server policy")).resolves.toBe("From Groq");
    expect(fetchMock.mock.calls[1][0]).toContain("api.groq.com");
    const request = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(request).not.toHaveProperty("reasoning_effort");
  });

  it("falls back to Groq when Gemini is unavailable", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GROQ_API_KEY = "groq-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce(answer("From Groq")),
    );

    await expect(requestAnswer([], "server policy")).resolves.toBe("From Groq");
  });

  it("normalizes upstream failures", async () => {
    process.env.GROQ_API_KEY = "groq-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(requestAnswer([], "server policy")).rejects.toBeInstanceOf(
      ProviderResponseError,
    );
  });

  it("waits out a short rate limit on the last provider and retries", async () => {
    vi.useFakeTimers();
    process.env.GROQ_API_KEY = "groq-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited({ "x-ratelimit-reset-tokens": "1.5s" }))
      .mockResolvedValueOnce(answer("Answer"));
    vi.stubGlobal("fetch", fetchMock);

    const pending = requestAnswer([], "server policy");
    await vi.advanceTimersByTimeAsync(1_500);
    await expect(pending).resolves.toBe("Answer");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports the shortest retry time when every provider is rate limited", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GROQ_API_KEY = "groq-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(rateLimited({ "retry-after": "20" }))
        .mockResolvedValueOnce(rateLimited({ "retry-after": "42" })),
    );

    const error = await requestAnswer([], "server policy").catch((e) => e);
    expect(error).toBeInstanceOf(ProviderRateLimitError);
    expect(error.retryAfterSeconds).toBe(20);
  });
});
