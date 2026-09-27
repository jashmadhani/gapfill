import { Fragment } from "react";

/** Turns **bold** and `code` inside one line into React nodes. No HTML, no dangerouslySetInnerHTML - just text runs. */
function inline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <b key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</b>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={`${keyPrefix}-${i}`} className="rounded bg-black/10 px-1 py-0.5 text-[0.9em]">{part.slice(1, -1)}</code>;
    return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
  });
}

/** The assistants reply with light markdown (headings as **bold**, "- " bullets, blank-line paragraphs). This
 * renders that plainly instead of showing the literal ** and - characters in a chat bubble. Deliberately not a full
 * markdown engine: no links, no tables, no raw HTML - there's no need for more here, and less to sanitize. */
export default function ChatMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: { type: "p" | "ul"; lines: string[] }[] = [];
  for (const line of lines) {
    const bullet = /^\s*[-*]\s+(.*)/.exec(line);
    if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last?.type === "ul") last.lines.push(bullet[1]);
      else blocks.push({ type: "ul", lines: [bullet[1]] });
    } else if (line.trim() === "") {
      blocks.push({ type: "p", lines: [""] });
    } else {
      const last = blocks[blocks.length - 1];
      if (last?.type === "p" && last.lines[last.lines.length - 1] !== "") last.lines.push(line);
      else blocks.push({ type: "p", lines: [line] });
    }
  }
  return (
    <div className="space-y-1.5">
      {blocks.map((b, i) =>
        b.type === "ul" ? (
          <ul key={i} className="list-disc space-y-0.5 pl-5">
            {b.lines.map((l, j) => (
              <li key={j}>{inline(l, `${i}-${j}`)}</li>
            ))}
          </ul>
        ) : (
          b.lines.filter((l) => l !== "").length > 0 && (
            <p key={i}>
              {b.lines
                .filter((l) => l !== "")
                .map((l, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    {inline(l, `${i}-${j}`)}
                  </Fragment>
                ))}
            </p>
          )
        )
      )}
    </div>
  );
}
