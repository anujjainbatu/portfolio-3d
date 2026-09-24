import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkChatRateLimit,
  RateLimitConfigurationError,
} from "../server/rateLimit";

const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
  if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
});

describe("Upstash REST rate limiter", () => {
  it("rejects placeholder configuration before making a request", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "your_upstash_redis_rest_url";
    process.env.UPSTASH_REDIS_REST_TOKEN = "your_upstash_redis_rest_token";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkChatRateLimit("127.0.0.1")).rejects.toBeInstanceOf(
      RateLimitConfigurationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("runs the atomic sliding-window script through the REST API", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "secret-token";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: [1, Date.now() + 600_000] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkChatRateLimit("127.0.0.1")).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://redis.example.test");
    expect(request.headers.Authorization).toBe("Bearer secret-token");
    const command = JSON.parse(request.body);
    expect(command[0]).toBe("EVAL");
    expect(command[2]).toBe("1");
    expect(command.at(-1)).toBe("15");
  });

  it("maps a full window to retry guidance", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "secret-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: [0, Date.now() + 42_000] }),
      }),
    );

    const result = await checkChatRateLimit("127.0.0.1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(41);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(42);
  });
});
