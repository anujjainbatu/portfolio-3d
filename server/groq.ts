import type { ChatTurn } from "./chatValidation.js";
import { isConfiguredValue } from "./environment.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";
const REQUEST_TIMEOUT_MS = 15_000;

export class ProviderConfigurationError extends Error {}
export class ProviderResponseError extends Error {}

interface GroqResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function requestGroqAnswer(
  messages: ChatTurn[],
  systemPrompt: string,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim().replace(/^(["'])(.*)\1$/, "$2");
  if (!isConfiguredValue(apiKey)) {
    throw new ProviderConfigurationError("GROQ_API_KEY is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.25,
        max_tokens: 400,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ProviderResponseError(`Groq returned ${response.status}.`);
    }

    const data = (await response.json()) as GroqResponse;
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new ProviderResponseError("Groq returned an empty response.");
    }

    return answer;
  } catch (error) {
    if (
      error instanceof ProviderConfigurationError ||
      error instanceof ProviderResponseError
    ) {
      throw error;
    }
    throw new ProviderResponseError("Groq request failed.");
  } finally {
    clearTimeout(timeout);
  }
}
