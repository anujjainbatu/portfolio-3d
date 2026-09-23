import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderMarkdown, stripMarkdown } from "../src/chat/renderMarkdown";

const TABLE = [
  "Anuj’s work has produced clear results:",
  "",
  "| Project | Impact |",
  "|---------|--------|",
  "| **WhatsApp commerce** | ~₹15L/month attributed |",
  "| Fiverr backends | Repeat problems cut by 60 % |",
  "",
  "These translate into revenue and reliability.",
].join("\n");

describe("renderMarkdown", () => {
  it("renders a GitHub-flavoured table instead of leaking pipes", () => {
    const { container } = render(<div>{renderMarkdown(TABLE)}</div>);

    expect(container.querySelectorAll("th")).toHaveLength(2);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(screen.getByText("WhatsApp commerce").tagName).toBe("STRONG");
    expect(container.textContent).not.toContain("|");
    expect(container.textContent).not.toContain("---");
  });

  it("keeps a plain paragraph as a single text node", () => {
    const { container } = render(
      <div>{renderMarkdown("Anuj has built systems across 20+ client environments.")}</div>,
    );
    const paragraph = container.querySelector("p")!;
    expect(paragraph.childNodes).toHaveLength(1);
    expect(paragraph.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
  });

  it("renders lists, inline code and links", () => {
    const { container } = render(
      <div>{renderMarkdown("- uses `n8n`\n- see https://example.com")}</div>,
    );
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("code")?.textContent).toBe("n8n");
    const link = container.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("stripMarkdown", () => {
  it("reads a table as its cells, with no markers left for a screen reader", () => {
    const spoken = stripMarkdown(TABLE);
    expect(spoken).not.toContain("|");
    expect(spoken).not.toContain("**");
    expect(spoken).toContain("WhatsApp commerce");
    expect(spoken).toContain("Project, Impact");
  });

  it("drops list markers and heading hashes", () => {
    expect(stripMarkdown("## Impact\n- one\n- two")).toBe("Impact. one. two");
  });
});
