import * as React from "react";

/**
 * Renders a product description written in a simple plain-text format:
 *   "## Heading"       → section heading
 *   "- Label: value"   → list item with a bold label
 *   "- text"           → list item
 *   other lines        → one paragraph per line
 */
type Block =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    const last = blocks[blocks.length - 1];
    if (!line) {
      blocks.push({ kind: "paragraph", text: "" });
    } else if (line.startsWith("## ")) {
      blocks.push({ kind: "heading", text: line.slice(3).trim() });
    } else if (/^[-•]\s+/.test(line)) {
      const item = line.replace(/^[-•]\s+/, "");
      if (last?.kind === "list") last.items.push(item);
      else blocks.push({ kind: "list", items: [item] });
    } else {
      blocks.push({ kind: "paragraph", text: line });
    }
  }
  return blocks.filter((b) => b.kind !== "paragraph" || b.text);
}

function ListItem({ text }: { text: string }) {
  const match = /^([^:]{2,40}):\s+(.+)$/.exec(text);
  if (!match) return <li>{text}</li>;
  return (
    <li>
      <span className="font-medium text-text">{match[1]}:</span> {match[2]}
    </li>
  );
}

export function ProductDescription({ text }: { text: string }) {
  const blocks = React.useMemo(() => parse(text), [text]);
  return (
    <div className="prose-limit space-y-3 text-sm leading-relaxed text-muted-foreground">
      {blocks.map((block, i) =>
        block.kind === "heading" ? (
          <h3 key={i} className="pt-3 text-base font-medium text-text first:pt-0">
            {block.text}
          </h3>
        ) : block.kind === "list" ? (
          <ul key={i} className="list-disc space-y-1 pl-5 marker:text-border-strong">
            {block.items.map((item, j) => (
              <ListItem key={j} text={item} />
            ))}
          </ul>
        ) : (
          <p key={i}>{block.text}</p>
        ),
      )}
    </div>
  );
}
