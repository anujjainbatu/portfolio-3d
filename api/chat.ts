type HeaderValue = string | string[] | undefined;

interface NodeChatRequest {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
  socket?: { remoteAddress?: string };
}

interface NodeChatResponse {
  statusCode: number;
  setHeader(name: string, value: string | number): void;
  end(body?: string): void;
}

// Prefer Vercel's Web API contract while remaining compatible with its legacy
// Node request/response runtime. The runtime has changed independently of the
// project's code before, so the entrypoint deliberately handles both shapes.
export const config = { useWebApi: true };

const isWebRequest = (
  request: Request | NodeChatRequest,
): request is Request =>
  typeof (request as Request).json === "function" &&
  typeof (request as Request).headers?.forEach === "function";

const runChatHandler = async (
  request: NodeChatRequest,
  response: NodeChatResponse,
) => {
  // Keeping the application import inside the guarded invocation means a
  // packaging/bootstrap error becomes useful JSON and a Vercel log entry.
  const { createChatHandler } = await import("../server/chatHandler.js");
  await createChatHandler()(request, response);
};

const createWebResponseAdapter = () => {
  let statusCode = 200;
  let responseBody = "";
  const headers = new Headers();

  return {
    response: {
      get statusCode() {
        return statusCode;
      },
      set statusCode(code: number) {
        statusCode = code;
      },
      setHeader(name: string, value: string | number) {
        headers.set(name, String(value));
      },
      end(value?: string) {
        responseBody = value || "";
      },
    } satisfies NodeChatResponse,
    finish: () =>
      new Response(responseBody, {
        status: statusCode,
        headers,
      }),
  };
};

const toNodeRequest = async (request: Request): Promise<NodeChatRequest> => {
  const headers: NodeChatRequest["headers"] = {};
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

  return { method: request.method, headers, body };
};

const bootstrapErrorBody = JSON.stringify({
  error: {
    code: "function_bootstrap_failed",
    message: "The assistant function could not start.",
  },
});

export default async function handler(
  request: Request | NodeChatRequest,
  response?: NodeChatResponse,
): Promise<Response | void> {
  const webRequest = isWebRequest(request);

  try {
    if (webRequest) {
      const adapter = createWebResponseAdapter();
      await runChatHandler(await toNodeRequest(request), adapter.response);
      return adapter.finish();
    }

    if (!response) throw new Error("Vercel did not provide a response object.");
    await runChatHandler(request, response);
  } catch (error) {
    console.error(
      "portfolio_chat_function_bootstrap_failed",
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { message: "Unknown bootstrap error" },
    );

    if (webRequest) {
      return new Response(bootstrapErrorBody, {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (response && typeof response.end === "function") {
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(bootstrapErrorBody);
      return;
    }

    throw error;
  }
}
