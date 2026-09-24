import { createHmac, randomUUID } from "node:crypto";
import { isConfiguredValue } from "./environment.js";

const RATE_LIMIT = 15;
const WINDOW_MS = 10 * 60 * 1_000;

// One atomic Redis operation: discard expired requests, reject when the
// window is full, otherwise append this request and refresh the key TTL.
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local member = ARGV[2]
local window = tonumber(ARGV[3])
local limit = tonumber(ARGV[4])

redis.call("ZREMRANGEBYSCORE", key, 0, now - window)
local count = redis.call("ZCARD", key)

if count >= limit then
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  local reset = now + window
  if oldest[2] then reset = tonumber(oldest[2]) + window end
  return {0, reset}
end

redis.call("ZADD", key, now, member)
redis.call("PEXPIRE", key, window)
return {1, now + window}
`;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface UpstashResponse {
  result?: unknown;
  error?: string;
}

export class RateLimitConfigurationError extends Error {}

const getConfiguration = () => {
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

  return { url: url.replace(/\/+$/, ""), token };
};

export async function checkChatRateLimit(ipAddress: string): Promise<RateLimitResult> {
  const { url, token } = getConfiguration();
  const identifier = createHmac("sha256", token)
    .update(ipAddress || "unknown")
    .digest("hex");
  const now = Date.now();
  const key = `portfolio-chat:${identifier}`;
  const member = `${now}:${randomUUID()}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      "EVAL",
      SLIDING_WINDOW_SCRIPT,
      "1",
      key,
      String(now),
      member,
      String(WINDOW_MS),
      String(RATE_LIMIT),
    ]),
  });

  const data = (await response.json().catch(() => ({}))) as UpstashResponse;
  if (!response.ok || data.error || !Array.isArray(data.result)) {
    throw new Error("Upstash rate limiting request failed.");
  }

  const [allowedValue, resetValue] = data.result;
  const allowed = Number(allowedValue) === 1;
  const reset = Number(resetValue);
  if (!Number.isFinite(reset)) {
    throw new Error("Upstash returned an invalid rate limit result.");
  }

  return {
    allowed,
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((reset - Date.now()) / 1_000)),
  };
}
