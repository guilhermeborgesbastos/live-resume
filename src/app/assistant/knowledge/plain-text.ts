/*
 * Converts the HTML stored in the CV JSON into inert plain text. It works on the string only:
 * nothing is parsed into a DOM, so no markup is attached to the page, no script runs and no
 * resource (image, iframe, ...) is fetched while extracting text.
 */

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  middot: "·",
  copy: "©",
  reg: "®",
  trade: "™"
};

// Elements whose content is never text for the reader.
const INERT_ELEMENTS = /<\s*(script|style|template|noscript|iframe|object|embed|svg|math|textarea|select)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
// An inert element that is never closed hides everything after it.
const UNCLOSED_INERT_ELEMENT = /<\s*(script|style|template|noscript|iframe|object|embed|svg|math|textarea|select)\b[\s\S]*$/i;
const COMMENTS = /<!--[\s\S]*?(-->|$)/g;
const LINE_BREAKS = /<\s*\/?\s*br\s*\/?\s*>/gi; // <br>, <br/>, and the nonstandard </br>
const LIST_ITEM_START = /<\s*li\b[^>]*>/gi;
const BLOCK_BOUNDARIES = /<\s*\/?\s*(p|div|ul|ol|li|h[1-6]|section|article|header|footer|blockquote|pre|table|thead|tbody|tr|dl|dt|dd)\b[^>]*>/gi;
const ANY_TAG = /<\s*\/?\s*[a-zA-Z][^>]*>/g;
const ENTITY = /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g;

function decodeEntities(text: string): string {
  return text.replace(ENTITY, (match, body: string) => {
    if (body[0] === "#") {
      const codePoint = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      const valid = codePoint > 0 && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff);
      return valid ? String.fromCodePoint(codePoint) : "";
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Paragraphs of plain text; single line breaks inside a paragraph are kept as "\n". */
export function htmlToParagraphs(html: string): string[] {
  const text = decodeEntities(
    html
      .replace(/\r\n?/g, "\n")
      // Source line breaks are formatting, not content (HTML collapses them too).
      .replace(/\n/g, " ")
      .replace(COMMENTS, "")
      .replace(INERT_ELEMENTS, "")
      .replace(UNCLOSED_INERT_ELEMENT, "")
      .replace(LINE_BREAKS, "\n")
      .replace(LIST_ITEM_START, "\n\n• ")
      .replace(BLOCK_BOUNDARIES, "\n\n")
      .replace(ANY_TAG, "")
  );

  return text
    .split(/\n[ \t ]*\n+/)
    .map(paragraph => paragraph
      .split("\n")
      .map(line => line.replace(/[ \t ]+/g, " ").trim())
      .filter(line => line.length > 0)
      .join("\n"))
    .filter(paragraph => paragraph.length > 0)
    // Consecutive list items read as one paragraph, like the CV's own "•" lines.
    .reduce<string[]>((paragraphs, paragraph) => {
      const previous = paragraphs[paragraphs.length - 1];
      if (previous !== undefined && paragraph.startsWith("• ") && previous.split("\n").pop()!.startsWith("• ")) {
        paragraphs[paragraphs.length - 1] = `${previous}\n${paragraph}`;
      } else {
        paragraphs.push(paragraph);
      }
      return paragraphs;
    }, []);
}

/** A single line of plain text (for titles and labels). */
export function htmlToLine(html: string): string {
  return htmlToParagraphs(html).join(" ").replace(/\s+/g, " ").trim();
}
