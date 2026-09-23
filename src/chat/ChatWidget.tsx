import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  FiCheck,
  FiCopy,
  FiFileText,
  FiGithub,
  FiLinkedin,
  FiMail,
  FiMaximize2,
  FiMinimize2,
  FiRefreshCw,
  FiArrowUp,
  FiSquare,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { TbMessage, TbNotes } from "react-icons/tb";
import { config } from "../config";
import HoverLinks from "../components/HoverLinks";
import RobotAvatar from "./RobotAvatar";
import { useChat } from "./ChatContext";
import { renderMarkdown, stripMarkdown } from "./renderMarkdown";
import "./ChatWidget.css";

/**
 * Chips show a short label but send — and announce — the full question.
 *
 * The label alone would make a poor prompt and a worse accessible name, so the
 * button's aria-label carries the real question. Anything matching on these
 * buttons therefore matches the question text, not the label.
 */
const SUGGESTED_QUESTIONS = [
  {
    label: "Strongest AI system built",
    question: "What is the strongest system Anuj has built?",
  },
  {
    label: "Commerce automation projects",
    question: "What commerce automation has Anuj built?",
  },
  {
    label: "Engineering approach",
    question: "How does Anuj approach a new problem?",
  },
  { label: "Career journey", question: "Tell me about Anuj's career pivot." },
  {
    label: "Fit for solutions engineering",
    question: "Why is Anuj a good fit for solutions engineering?",
  },
  {
    label: "Measurable impact",
    question: "What measurable impact has his work created?",
  },
];

const WELCOME =
  "I’m Anuj’s AI assistant. Ask me about his projects, experience, working style, or career journey.";

const MAX_INPUT = 1_500;
const COUNTER_THRESHOLD = Math.round(MAX_INPUT * 0.8);
const EXPANDED_KEY = "portfolio-chat:expanded";

const formatRetryTime = (seconds: number) => {
  if (seconds < 60) return `${seconds} seconds`;
  return `${Math.ceil(seconds / 60)} minutes`;
};

const readExpanded = () => {
  try {
    return window.sessionStorage.getItem(EXPANDED_KEY) === "1";
  } catch {
    return false;
  }
};

const ChatWidget = () => {
  const {
    isOpen,
    messages,
    status,
    error,
    openChat,
    closeChat,
    sendQuestion,
    retry,
    regenerate,
    stop,
    clearConversation,
  } = useChat();
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => setIsExpanded(readExpanded()), []);

  useEffect(() => {
    if (!isOpen) {
      if (wasOpen.current) launcherRef.current?.focus();
      wasOpen.current = false;
      document.documentElement.classList.remove("chat-modal-open");
      return;
    }

    wasOpen.current = true;
    document.documentElement.classList.add("chat-modal-open");
    window.requestAnimationFrame(() => inputRef.current?.focus());

    const handleKeyboard = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closeChat();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], textarea:not([disabled])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyboard);
    return () => {
      document.documentElement.classList.remove("chat-modal-open");
      document.removeEventListener("keydown", handleKeyboard);
    };
  }, [closeChat, isOpen]);

  // Scroll the transcript itself rather than calling scrollIntoView, which can
  // also move the page behind the panel.
  useEffect(() => {
    if (!isOpen) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [isOpen, messages, status, error]);

  // Keep the composer above the on-screen keyboard on mobile.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!isOpen || !viewport) return;

    const apply = () => {
      const inset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      dialogRef.current?.style.setProperty("--chat-keyboard-inset", `${inset}px`);
    };

    apply();
    viewport.addEventListener("resize", apply);
    viewport.addEventListener("scroll", apply);
    return () => {
      viewport.removeEventListener("resize", apply);
      viewport.removeEventListener("scroll", apply);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!copiedId) return;
    const timer = setTimeout(() => setCopiedId(null), 1_600);
    return () => clearTimeout(timer);
  }, [copiedId]);

  const growComposer = () => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const question = input.trim();
    if (!question || status === "sending") return;
    setInput("");
    window.requestAnimationFrame(growComposer);
    await sendQuestion(question);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const askSuggestion = async (question: string) => {
    await sendQuestion(question);
  };

  const copyAnswer = async (message: { id: string; content: string }) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
    } catch {
      // Clipboard access can be denied; failing quietly is better than an alert.
    }
  };

  const toggleExpanded = () => {
    setIsExpanded((current) => {
      const next = !current;
      try {
        window.sessionStorage.setItem(EXPANDED_KEY, next ? "1" : "0");
      } catch {
        // A blocked sessionStorage must not break the toggle.
      }
      return next;
    });
  };

  const lastMessage = messages.at(-1);

  // Offer only questions the visitor has not already asked, so the panel always
  // has an obvious next step instead of dead-ending after the first answer.
  const followUps = useMemo(() => {
    const asked = new Set(
      messages.filter((message) => message.role === "user").map((m) => m.content),
    );
    return SUGGESTED_QUESTIONS.filter((item) => !asked.has(item.question)).slice(0, 3);
  }, [messages]);

  const showFollowUps =
    lastMessage?.role === "assistant" &&
    status === "idle" &&
    !error &&
    followUps.length > 0;

  const latestAnswer =
    lastMessage?.role === "assistant" ? stripMarkdown(lastMessage.content) : "";

  return (
    <div className="portfolio-chat" data-cursor="disable">
      {!isOpen && (
        <div className="portfolio-chat__rail">
          <button
            ref={launcherRef}
            type="button"
            className="portfolio-chat__launcher"
            onClick={openChat}
            aria-haspopup="dialog"
            aria-label="Ask Anuj's AI assistant"
          >
            <HoverLinks text="LET'S TALK" />
            <span aria-hidden="true">
              <TbMessage />
            </span>
          </button>
          <a
            className="portfolio-chat__rail-link"
            href={config.contact.resume}
            target="_blank"
            rel="noopener noreferrer"
          >
            <HoverLinks text="RESUME" />
            <span aria-hidden="true">
              <TbNotes />
            </span>
          </a>
        </div>
      )}

      {isOpen && (
        <>
          <button
            type="button"
            className="portfolio-chat__backdrop"
            onClick={closeChat}
            aria-label="Dismiss chat backdrop"
          />
          <section
            ref={dialogRef}
            className={`portfolio-chat__dialog${
              isExpanded ? " portfolio-chat__dialog--expanded" : ""
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Anuj’s AI assistant"
            aria-describedby="portfolio-chat-disclosure"
          >
            <header className="portfolio-chat__header">
              <RobotAvatar />
              <div className="portfolio-chat__identity">
                <p className="portfolio-chat__eyebrow">AI profile assistant</p>
                <h2 id="portfolio-chat-title">
                  Anuj AI
                  <span className="portfolio-chat__status">
                    <span className="portfolio-chat__status-dot" aria-hidden="true" />
                    Online
                  </span>
                </h2>
                <p className="portfolio-chat__role">Personal AI Assistant</p>
              </div>
              <button
                type="button"
                className="portfolio-chat__icon-button portfolio-chat__expand"
                onClick={toggleExpanded}
                aria-pressed={isExpanded}
                aria-label={isExpanded ? "Collapse chat panel" : "Expand chat panel"}
                title={isExpanded ? "Collapse panel" : "Expand panel"}
              >
                {isExpanded ? <FiMinimize2 /> : <FiMaximize2 />}
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  className="portfolio-chat__icon-button"
                  onClick={clearConversation}
                  aria-label="Clear conversation"
                  title="Clear conversation"
                >
                  <FiTrash2 />
                </button>
              )}
              <button
                type="button"
                className="portfolio-chat__icon-button"
                onClick={closeChat}
                aria-label="Close chat"
              >
                <FiX />
              </button>
            </header>

            <div className="portfolio-chat__messages" ref={listRef}>
              {messages.length === 0 && (
                <div className="portfolio-chat__empty">
                  <p className="portfolio-chat__welcome">{WELCOME}</p>
                  {/* The AI disclosure is an honesty affordance, not decoration.
                      It moved out of the header with the redesign but keeps its
                      id so the dialog's aria-describedby still resolves. */}
                  <p
                    className="portfolio-chat__disclosure"
                    id="portfolio-chat-disclosure"
                  >
                    <span className="portfolio-chat__badge">AI</span>
                    Answers from Anuj’s approved public profile
                  </p>
                  <p className="portfolio-chat__starters-label">Start with</p>
                  <ul
                    className="portfolio-chat__starters"
                    aria-label="Suggested questions"
                  >
                    {SUGGESTED_QUESTIONS.slice(0, 4).map((item) => (
                      <li key={item.question}>
                        <button
                          type="button"
                          aria-label={item.question}
                          onClick={() => void askSuggestion(item.question)}
                        >
                          <span aria-hidden="true">✦</span>
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {messages.map((message) => {
                const isAssistant = message.role === "assistant";
                const isLast = message.id === lastMessage?.id;
                return (
                  <div
                    className={`portfolio-chat__turn portfolio-chat__turn--${message.role}`}
                    key={message.id}
                  >
                    <div
                      className={`portfolio-chat__message portfolio-chat__message--${message.role}`}
                    >
                      {isAssistant ? renderMarkdown(message.content) : message.content}
                    </div>
                    {isAssistant && (
                      <div className="portfolio-chat__actions">
                        <button
                          type="button"
                          onClick={() => void copyAnswer(message)}
                          aria-label={
                            copiedId === message.id ? "Answer copied" : "Copy answer"
                          }
                        >
                          {copiedId === message.id ? <FiCheck /> : <FiCopy />}
                          {copiedId === message.id ? "Copied" : "Copy"}
                        </button>
                        {isLast && status !== "sending" && (
                          <button
                            type="button"
                            onClick={() => void regenerate()}
                            aria-label="Regenerate answer"
                          >
                            <FiRefreshCw /> Regenerate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {status === "sending" && (
                <div className="portfolio-chat__thinking">
                  <span className="portfolio-chat__typing" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="portfolio-chat__thinking-label">
                    Anuj AI is thinking…
                  </span>
                  <button
                    type="button"
                    className="portfolio-chat__stop"
                    onClick={stop}
                    aria-label="Stop generating"
                  >
                    <FiSquare /> Stop
                  </button>
                </div>
              )}

              {error && (
                <div
                  className={`portfolio-chat__notice portfolio-chat__notice--${error.status}`}
                  role="alert"
                >
                  <p>{error.message}</p>
                  {error.retryAfterSeconds && (
                    <small>
                      Try again in about {formatRetryTime(error.retryAfterSeconds)}.
                    </small>
                  )}
                  {lastMessage?.role === "user" && error.status !== "rate-limited" && (
                    <button type="button" onClick={() => void retry()}>
                      <FiRefreshCw /> Retry
                    </button>
                  )}
                </div>
              )}

              {showFollowUps && (
                <div className="portfolio-chat__followups">
                  <p className="portfolio-chat__starters-label">Ask next</p>
                  <ul aria-label="Follow-up questions">
                    {followUps.map((item) => (
                      <li key={item.question}>
                        <button
                          type="button"
                          aria-label={item.question}
                          onClick={() => void askSuggestion(item.question)}
                        >
                          <span aria-hidden="true">✦</span>
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Only assistant answers reach the live region, so screen readers
                are not read the visitor's own words back to them. */}
            <p className="sr-only" aria-live="polite">
              {latestAnswer}
            </p>

            <form className="portfolio-chat__composer" onSubmit={submit}>
              <label className="sr-only" htmlFor="portfolio-chat-input">
                Ask a question about Anuj
              </label>
              <div className="portfolio-chat__composer-field">
                <textarea
                  ref={inputRef}
                  id="portfolio-chat-input"
                  rows={1}
                  maxLength={MAX_INPUT}
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value);
                    growComposer();
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Ask Anuj AI anything…"
                />
                <button
                  type="submit"
                  disabled={status === "sending" || input.trim().length === 0}
                  aria-label="Send question"
                >
                  <FiArrowUp />
                </button>
              </div>
              {input.length >= COUNTER_THRESHOLD && (
                <p className="portfolio-chat__counter" aria-live="polite">
                  {input.length} / {MAX_INPUT}
                </p>
              )}
            </form>

            <footer className="portfolio-chat__links" aria-label="Anuj's public links">
              <p className="portfolio-chat__ready">
                <span className="portfolio-chat__ready-dot" aria-hidden="true" />
                AI Ready
              </p>
              {/* These four are the way out of the chat for someone an answer
                  just convinced, so they stay. Only their text labels drop. */}
              <span className="portfolio-chat__link-row">
                <a
                  href={`mailto:${config.contact.email}`}
                  aria-label="Email Anuj"
                  title="Email"
                >
                  <FiMail />
                </a>
                <a
                  href={config.contact.github}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Anuj on GitHub"
                  title="GitHub"
                >
                  <FiGithub />
                </a>
                <a
                  href={config.contact.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Anuj on LinkedIn"
                  title="LinkedIn"
                >
                  <FiLinkedin />
                </a>
                <a
                  href={config.contact.resume}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Anuj’s résumé"
                  title="Résumé"
                >
                  <FiFileText />
                </a>
              </span>
            </footer>
          </section>
        </>
      )}
    </div>
  );
};

export default ChatWidget;
