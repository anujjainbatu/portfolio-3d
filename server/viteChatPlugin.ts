import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv, type Plugin } from "vite";
import { createChatHandler, type ChatResponse } from "./chatHandler";
import { CHAT_LIMITS } from "./chatValidation";

class PayloadTooLargeError extends Error {}

const CHAT_ENVIRONMENT_KEYS = [
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

function refreshChatEnvironment(mode: string) {
  const savedEnvironment = loadEnv(mode, process.cwd(), "");
  for (const name of CHAT_ENVIRONMENT_KEYS) {
    if (savedEnvironment[name]) process.env[name] = savedEnvironment[name];
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > CHAT_LIMITS.maxPayloadBytes) throw new PayloadTooLargeError();
    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : undefined;
}

function sendDevelopmentError(
  response: ServerResponse,
  code: string,
  message: string,
) {
  response.statusCode = 400;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({ error: { code, message } }));
}

/** Runs the production chat handler inside `vite dev`; no secrets reach Vite's client bundle. */
export function viteChatPlugin(mode = "development"): Plugin {
  refreshChatEnvironment(mode);

  return {
    name: "portfolio-local-chat-api",
    apply: "serve",
    configureServer(server) {
      const handler = createChatHandler();

      server.middlewares.use("/api/chat", async (request, response) => {
        // Vite may keep the same Node process after .env changes. Refresh on
        // each development request so saved credentials take effect at once.
        refreshChatEnvironment(mode);

        let body: unknown;
        if (request.method === "POST") {
          try {
            body = await readJsonBody(request);
          } catch (error) {
            if (error instanceof PayloadTooLargeError) {
              sendDevelopmentError(
                response,
                "payload_too_large",
                "The chat request is too large.",
              );
            } else {
              sendDevelopmentError(
                response,
                "invalid_json",
                "The request body must be valid JSON.",
              );
            }
            return;
          }
        }

        const responseAdapter: ChatResponse = {
          get statusCode() {
            return response.statusCode;
          },
          set statusCode(code) {
            response.statusCode = code;
          },
          setHeader(name, value) {
            response.setHeader(name, value);
          },
          end(value) {
            response.end(value);
          },
        };

        await handler(
          {
            method: request.method,
            headers: request.headers,
            body,
            socket: { remoteAddress: request.socket.remoteAddress },
          },
          responseAdapter,
        );
      });
    },
  };
}
