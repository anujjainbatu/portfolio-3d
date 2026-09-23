import type { ReactNode } from "react";

/**
 * A deliberately small Markdown renderer for assistant answers.
 *
 * It covers only what the provider actually emits (see server/groq.ts): short
 * paragraphs, bullet and numbered lists, bold/italic/inline code, fenced code
 * blocks, and bare URLs. Anything it does not recognise falls through as plain
 * text, which is the correct failure mode for a chat transcript.
 *
 * It returns React elements rather than an HTML string on purpose: nothing is
 * ever handed to dangerouslySetInnerHTML, so model output cannot inject markup
 * and no sanitiser dependency is needed.
 *
 * One invariant worth keeping: a run of plain text is emitted as a *single*
 * string child, never split across nodes, so the rendered paragraph keeps one
 * text node and stays queryable by its full sentence.
 */

// This module exports Markdown helpers, not components — the fast-refresh rule
// mistakes the SCREAMING_CASE regex constants for component declarations.
/* eslint-disable react-refresh/only-export-components */

const INLINE_PATTERN =
  /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g;

const UNORDERED_ITEM = /^\s*[-*•]\s+(.*)$/;
const ORDERED_ITEM = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;
const FENCE = /^\s*```(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_DIVIDER = /^\s*\|[\s:|-]*-[\s:|-]*\|\s*$/;

const splitRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

const renderInline = (text: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const pattern = new RegExp(INLINE_PATTERN.source, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));

    const token = match[0];
    const key = `${keyPrefix}-i${match.index}`;

    if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("http")) {
      nodes.push(
        <a key={key} href={token} target="_blank" rel="noopener noreferrer">
          {token}
        </a>,
      );
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    cursor = match.index + token.length;
  }

  if (cursor === 0) return [text];
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
};

/**
 * The same content with its markers removed, for the live region. A screen
 * reader should hear the sentence, not "star star impact star star".
 */
export function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .split("\n")
    .filter((line) => !TABLE_DIVIDER.test(line))
    .map((line) =>
      // Table rows read as their cells, not as a row of pipes.
      TABLE_ROW.test(line) ? splitRow(line).filter(Boolean).join(", ") : line,
    )
    .map((line) =>
      line
        .replace(HEADING, "$1")
        .replace(UNORDERED_ITEM, "$1")
        .replace(ORDERED_ITEM, "$1")
        .replace(/\*\*([^*\n]+)\*\*/g, "$1")
        .replace(/\*([^*\n]+)\*/g, "$1")
        .replace(/_([^_\n]+)_/g, "$1")
        .replace(/`([^`\n]+)`/g, "$1")
        .trim(),
    )
    .filter(Boolean)
    .join(". ");
}

export function renderMarkdown(content: string): ReactNode[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let fenceLines: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const key = `p${blocks.length}`;
    // Soft line breaks inside a paragraph collapse to spaces, so the whole
    // paragraph stays a single text node when it contains no inline markup.
    blocks.push(<p key={key}>{renderInline(paragraph.join(" "), key)}</p>);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    const key = `l${blocks.length}`;
    const items = listItems.map((item, index) => (
      <li key={`${key}-${index}`}>{renderInline(item, `${key}-${index}`)}</li>
    ));
    blocks.push(
      listOrdered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>,
    );
    listItems = [];
  };

  const flushBlocks = () => {
    flushParagraph();
    flushList();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = FENCE.exec(line);

    if (fenceLines) {
      if (fence) {
        const key = `c${blocks.length}`;
        blocks.push(
          <pre key={key}>
            <code>{fenceLines.join("\n")}</code>
          </pre>,
        );
        fenceLines = null;
      } else {
        fenceLines.push(line);
      }
      continue;
    }

    if (fence) {
      flushBlocks();
      fenceLines = [];
      continue;
    }

    if (line.trim() === "") {
      flushBlocks();
      continue;
    }

    // A GitHub-flavoured table: a header row followed by a `|---|---|` divider.
    // The provider reaches for these often when asked about impact or metrics.
    if (TABLE_ROW.test(line) && TABLE_DIVIDER.test(lines[index + 1] ?? "")) {
      flushBlocks();
      const key = `t${blocks.length}`;
      const header = splitRow(line);
      const labels = header.map((cell) => stripMarkdown(cell));
      const rows: string[][] = [];
      let cursor = index + 2;
      while (cursor < lines.length && TABLE_ROW.test(lines[cursor])) {
        rows.push(splitRow(lines[cursor]));
        cursor += 1;
      }

      blocks.push(
        <div className="portfolio-chat__table" key={key}>
          <table>
            <thead>
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={cellIndex} scope="col">
                    {renderInline(cell, `${key}-h${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    // data-label carries the column name so a narrow panel can
                    // stack each row as labelled lines instead of scrolling
                    // sideways (see ChatWidget.css).
                    <td key={cellIndex} data-label={labels[cellIndex] ?? ""}>
                      {renderInline(cell, `${key}-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );

      index = cursor - 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushBlocks();
      const key = `h${blocks.length}`;
      blocks.push(<h4 key={key}>{renderInline(heading[1], key)}</h4>);
      continue;
    }

    const unordered = UNORDERED_ITEM.exec(line);
    const ordered = unordered ? null : ORDERED_ITEM.exec(line);
    if (unordered || ordered) {
      const nextOrdered = Boolean(ordered);
      // A change of list type starts a new list rather than mixing markers.
      if (listItems.length > 0 && nextOrdered !== listOrdered) flushList();
      flushParagraph();
      listOrdered = nextOrdered;
      listItems.push((unordered ?? ordered)![1]);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  // An answer truncated mid-fence still shows the code it managed to send.
  if (fenceLines && fenceLines.length > 0) {
    blocks.push(
      <pre key={`c${blocks.length}`}>
        <code>{fenceLines.join("\n")}</code>
      </pre>,
    );
  }
  flushBlocks();

  return blocks;
}
