import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProviderConfigurationError,
  ProviderResponseError,
  requestGroqAnswer,
} from "../server/groq";

const originalKey = process.env.GROQ_API_KEY;
const originalModel = process.env.GROQ_MODEL;

afterEach(() => {
  if (originalKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GROQ_MODEL;
  else process.env.GROQ_MODEL = originalModel;
});

describe("Groq provider adapter", () => {
  it("fails safely when the API key is missing", async () => {
    delete process.env.GROQ_API_KEY;
    await expect(requestGroqAnswer([], "server policy")).rejects.toBeInstanceOf(
      ProviderConfigurationError,
    );
  });

  it("keeps policy server-owned and caps the provider request", async () => {
    process.env.GROQ_API_KEY = "test-key";
    process.env.GROQ_MODEL = "test-model";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "  Approved answer  " } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestGroqAnswer([{ role: "user", content: "What has Anuj built?" }], "server policy"),
    ).resolves.toBe("Approved answer");

    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request).toMatchObject({
      model: "test-model",
      temperature: 0.25,
      max_tokens: 400,
      messages: [
        { role: "system", content: "server policy" },
        { role: "user", content: "What has Anuj built?" },
      ],
    });
  });

  it("normalizes upstream failures", async () => {
    process.env.GROQ_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(requestGroqAnswer([], "server policy")).rejects.toBeInstanceOf(
      ProviderResponseError,
    );
  });
});
