import {
  createChatHandler,
  type ChatRequest,
  type ChatResponse,
} from "../server/chatHandler";

const chatHandler = createChatHandler();

// Use Vercel's explicit Web API contract instead of its Node response shim.
export const config = { useWebApi: true };

export default async function handler(request: Request): Promise<Response> {
  const headers: ChatRequest["headers"] = {};
  request.headers.forEach((value, name) => {
    headers[name] = value;
  });
  if (!headers.host) headers.host = new URL(request.url).host;

  let body: unknown;
  if (request.method === "POST") {
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }
  }

  let statusCode = 200;
  let responseBody = "";
  const responseHeaders = new Headers();
  const responseAdapter: ChatResponse = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(code) {
      statusCode = code;
    },
    setHeader(name, value) {
      responseHeaders.set(name, String(value));
    },
    end(value) {
      responseBody = value || "";
    },
  };

  await chatHandler(
    {
      method: request.method,
      headers,
      body,
    },
    responseAdapter,
  );

  return new Response(responseBody, {
    status: statusCode,
    headers: responseHeaders,
  });
}
