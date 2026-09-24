import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { track } from "@vercel/analytics";
import { describe, expect, it, vi } from "vitest";
import { ChatProvider } from "../src/chat/ChatContext";
import ChatWidget from "../src/chat/ChatWidget";
import { CHAT_STORAGE_KEY } from "../src/chat/chatStorage";

const renderWidget = () =>
  render(
    <ChatProvider>
      <ChatWidget />
    </ChatProvider>,
  );

describe("ChatWidget", () => {
  it("opens accessibly, reacts through the mascot event, and closes with Escape", async () => {
    const user = userEvent.setup();
    const reaction = vi.fn();
    window.addEventListener("portfolio:chat-reaction", reaction);
    renderWidget();

    await user.click(screen.getByRole("button", { name: "Ask Anuj's AI assistant" }));
    expect(screen.getByRole("dialog", { name: "Anuj’s AI assistant" })).toBeInTheDocument();
    expect(reaction).toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    window.removeEventListener("portfolio:chat-reaction", reaction);
  });

  it("submits a suggestion, stores the answer in-session, and clears it", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ message: "Anuj has built systems across 20+ client environments." }),
      }),
    );
    renderWidget();
    await user.click(screen.getByRole("button", { name: "Ask Anuj's AI assistant" }));
    await user.click(screen.getByRole("button", { name: /strongest system/i }));

    // The answer appears twice by design: once in the transcript, once in the
    // visually hidden live region that announces it to screen readers.
    expect(
      await screen.findAllByText("Anuj has built systems across 20+ client environments."),
    ).toHaveLength(2);
    await waitFor(() => expect(window.sessionStorage.getItem(CHAT_STORAGE_KEY)).not.toBeNull());

    await user.click(screen.getByRole("button", { name: "Clear conversation" }));
    expect(window.sessionStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
    expect(screen.getByRole("button", { name: /strongest system/i })).toBeInTheDocument();
  });

  it("shows a retryable offline state without blocking the portfolio", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers(),
        json: async () => ({
          error: { code: "assistant_unavailable", message: "The assistant is temporarily unavailable." },
        }),
      }),
    );
    renderWidget();
    await user.click(screen.getByRole("button", { name: "Ask Anuj's AI assistant" }));
    await user.type(screen.getByLabelText("Ask a question about Anuj"), "What did he build?");
    await user.click(screen.getByRole("button", { name: "Send question" }));

    expect(await screen.findByText("The assistant is temporarily unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close chat" })).toBeEnabled();
  });

  it("shows rate-limit guidance without exposing message text to analytics", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "42" }),
        json: async () => ({
          error: { code: "rate_limited", message: "Too many questions." },
        }),
      }),
    );
    renderWidget();
    await user.click(screen.getByRole("button", { name: "Ask Anuj's AI assistant" }));
    await user.type(screen.getByLabelText("Ask a question about Anuj"), "Private prompt text");
    await user.click(screen.getByRole("button", { name: "Send question" }));

    expect(await screen.findByText("Too many questions.")).toBeInTheDocument();
    expect(screen.getByText(/42 seconds/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toContain("Private prompt text");
  });

  it("renders Markdown answers as formatting rather than literal characters", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          message: "He builds **durable** systems:\n- retries\n- logging",
        }),
      }),
    );
    renderWidget();
    await user.click(screen.getByRole("button", { name: "Ask Anuj's AI assistant" }));
    await user.click(screen.getByRole("button", { name: /strongest system/i }));

    const bold = await screen.findByText("durable");
    expect(bold.tagName).toBe("STRONG");
    expect(screen.getByText("retries").tagName).toBe("LI");
    // No raw Markdown leaks anywhere, including the live region.
    expect(document.body.textContent).not.toContain("**");
    expect(document.body.textContent).not.toContain("- retries");
  });

  it("offers unasked follow-up questions after an answer", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ message: "A WhatsApp and email commerce system." }),
      }),
    );
    renderWidget();
    await user.click(screen.getByRole("button", { name: "Ask Anuj's AI assistant" }));
    await user.click(screen.getByRole("button", { name: /strongest system/i }));

    // The question just asked drops out; unasked ones are offered as next steps.
    expect(await screen.findByRole("button", { name: /career pivot/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /strongest system/i })).not.toBeInTheDocument();
  });

  it("stops an in-flight answer and returns the panel to idle", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    renderWidget();
    await user.click(screen.getByRole("button", { name: "Ask Anuj's AI assistant" }));
    await user.click(screen.getByRole("button", { name: /strongest system/i }));

    const stopButton = await screen.findByRole("button", { name: "Stop generating" });
    await user.click(stopButton);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Stop generating" })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("copies an answer to the clipboard", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ message: "Six hospitals run on it." }),
      }),
    );
    renderWidget();
    await user.click(screen.getByRole("button", { name: "Ask Anuj's AI assistant" }));
    await user.click(screen.getByRole("button", { name: /strongest system/i }));

    await user.click(await screen.findByRole("button", { name: "Copy answer" }));

    expect(await screen.findByRole("button", { name: "Answer copied" })).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toBe("Six hospitals run on it.");
  });
});
