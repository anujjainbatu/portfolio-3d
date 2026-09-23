import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isConfiguredValue } from "./environment";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export class RateLimitConfigurationError extends Error {}

let rateLimiter: Ratelimit | null = null;
let rateLimiterConfiguration = "";

function getRateLimiter(): Ratelimit {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!isConfiguredValue(url) || !isConfiguredValue(token)) {
    throw new RateLimitConfigurationError("Upstash rate limiting is not configured.");
  }

  try {
    if (new URL(url).protocol !== "https:") throw new Error();
  } catch {
    throw new RateLimitConfigurationError("The Upstash URL is invalid.");
  }

  const configuration = `${url}\n${token}`;
  if (!rateLimiter || rateLimiterConfiguration !== configuration) {
    rateLimiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(15, "10 m"),
      prefix: "portfolio-chat",
      analytics: false,
    });
    rateLimiterConfiguration = configuration;
  }

  return rateLimiter;
}

export async function checkChatRateLimit(ipAddress: string): Promise<RateLimitResult> {
  const secret = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!isConfiguredValue(secret)) {
    throw new RateLimitConfigurationError("Upstash rate limiting is not configured.");
  }

  const identifier = createHmac("sha256", secret)
    .update(ipAddress || "unknown")
    .digest("hex");
  const result = await getRateLimiter().limit(identifier);

  return {
    allowed: result.success,
    retryAfterSeconds: result.success
      ? 0
      : Math.max(1, Math.ceil((result.reset - Date.now()) / 1_000)),
  };
}
