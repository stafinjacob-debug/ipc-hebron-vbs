/** Escape text for safe inclusion in HTML email bodies. */
export function escapeHtmlEmailBody(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

const PLAIN_TEXT_URL_RE =
  /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)}\]'"])/gi;

function trimTrailingUrlPunctuation(url: string): string {
  return url.replace(/[.,;:!?)}\]'"]+$/g, "");
}

function linkStyle(): string {
  return "color:#2563eb;text-decoration:underline;word-break:break-all;";
}

function sanitizeLinkHref(href: string): string | null {
  const trimmed = href.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^mailto:/i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

type InlineToken =
  | { kind: "plain"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "underline"; text: string }
  | { kind: "mdlink"; label: string; href: string };

function tokenizeInline(src: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let index = 0;

  while (index < src.length) {
    const rest = src.slice(index);
    let match: RegExpMatchArray | null;

    if ((match = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/))) {
      tokens.push({ kind: "mdlink", label: match[1]!, href: match[2]! });
      index += match[0].length;
      continue;
    }

    if ((match = rest.match(/^\*\*([^*\n]+)\*\*/))) {
      tokens.push({ kind: "bold", text: match[1]! });
      index += match[0].length;
      continue;
    }

    if ((match = rest.match(/^__([^_\n]+)__/))) {
      tokens.push({ kind: "underline", text: match[1]! });
      index += match[0].length;
      continue;
    }

    if ((match = rest.match(/^\*([^*\n]+)\*/))) {
      tokens.push({ kind: "italic", text: match[1]! });
      index += match[0].length;
      continue;
    }

    if ((match = rest.match(/^_([^_\n]+)_/))) {
      tokens.push({ kind: "italic", text: match[1]! });
      index += match[0].length;
      continue;
    }

    const nextSpecial = rest.search(/[\[*_]/);
    const chunk = nextSpecial === -1 ? rest : rest.slice(0, nextSpecial);
    if (chunk.length === 0) {
      tokens.push({ kind: "plain", text: rest[0]! });
      index += 1;
      continue;
    }

    tokens.push({ kind: "plain", text: chunk });
    index += chunk.length;
  }

  return tokens;
}

function linkifyPlainText(text: string): string {
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(PLAIN_TEXT_URL_RE.source, PLAIN_TEXT_URL_RE.flags);

  while ((match = re.exec(text)) !== null) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      parts.push(escapeHtmlEmailBody(text.slice(lastIndex, matchIndex)));
    }

    const rawUrl = match[1] ?? match[0];
    const url = trimTrailingUrlPunctuation(rawUrl);
    const trailing = rawUrl.slice(url.length);
    const href = /^www\./i.test(url) ? `https://${url}` : url;

    parts.push(
      `<a href="${escapeHtmlAttr(href)}" style="${linkStyle()}" target="_blank" rel="noopener noreferrer">${escapeHtmlEmailBody(url)}</a>`,
    );
    if (trailing) {
      parts.push(escapeHtmlEmailBody(trailing));
    }

    lastIndex = matchIndex + rawUrl.length;
  }

  if (lastIndex < text.length) {
    parts.push(escapeHtmlEmailBody(text.slice(lastIndex)));
  }

  return parts.join("");
}

function renderInlineTokens(tokens: InlineToken[]): string {
  return tokens
    .map((token) => {
      switch (token.kind) {
        case "plain":
          return linkifyPlainText(token.text);
        case "bold":
          return `<strong>${renderInlineTokens(tokenizeInline(token.text))}</strong>`;
        case "italic":
          return `<em>${renderInlineTokens(tokenizeInline(token.text))}</em>`;
        case "underline":
          return `<u>${renderInlineTokens(tokenizeInline(token.text))}</u>`;
        case "mdlink": {
          const href = sanitizeLinkHref(token.href);
          if (!href) {
            return escapeHtmlEmailBody(`[${token.label}](${token.href})`);
          }
          return `<a href="${escapeHtmlAttr(href)}" style="${linkStyle()}" target="_blank" rel="noopener noreferrer">${renderInlineTokens(tokenizeInline(token.label))}</a>`;
        }
        default:
          return "";
      }
    })
    .join("");
}

function formatEmailInline(text: string): string {
  return renderInlineTokens(tokenizeInline(text));
}

export type EmailTextAlign = "left" | "center" | "right" | "justify";

export const EMAIL_ALIGN_LINE_PREFIX: Record<EmailTextAlign, string> = {
  left: "",
  center: "|align:center| ",
  right: "|align:right| ",
  justify: "|align:justify| ",
};

export const EMAIL_ALIGN_LINE_PREFIX_RE = /^\|align:(left|center|right|justify)\|\s*/i;

const EMAIL_BODY_WRAPPER_STYLE =
  "font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#0f172a";

type ParsedEmailLine = {
  align: EmailTextAlign;
  isBullet: boolean;
  content: string;
};

function parseEmailLine(line: string): ParsedEmailLine {
  let align: EmailTextAlign = "left";
  let rest = line;
  const alignMatch = rest.match(EMAIL_ALIGN_LINE_PREFIX_RE);
  if (alignMatch) {
    align = alignMatch[1]!.toLowerCase() as EmailTextAlign;
    rest = rest.slice(alignMatch[0].length);
  }

  const bulletMatch = rest.match(/^[\-*]\s+(.+)$/);
  if (bulletMatch) {
    return { align, isBullet: true, content: bulletMatch[1]! };
  }

  return { align, isBullet: false, content: rest };
}

/** Turn plain-text paragraphs into HTML with formatting, line breaks, and clickable links. */
export function plainTextEmailBodyToHtml(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";

  const lines = trimmed.split(/\r?\n/);
  const htmlParts: string[] = [];
  let listItems: string[] = [];
  let listAlign: EmailTextAlign = "left";
  let paragraphLines: string[] = [];
  let paragraphAlign: EmailTextAlign = "left";

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    const inner = paragraphLines.map((line) => formatEmailInline(line)).join("<br/>");
    if (paragraphAlign === "left") {
      htmlParts.push(inner);
    } else {
      htmlParts.push(
        `<p style="margin:0 0 10px;text-align:${paragraphAlign};">${inner}</p>`,
      );
    }
    paragraphLines = [];
    paragraphAlign = "left";
  }

  function flushList() {
    if (listItems.length === 0) return;
    const listStyle =
      listAlign === "left"
        ? "margin:0 0 10px;padding-left:20px;"
        : `margin:0 0 10px;padding-left:20px;text-align:${listAlign};`;
    htmlParts.push(
      `<ul style="${listStyle}">${listItems
        .map((item) => `<li style="margin:0 0 4px;">${item}</li>`)
        .join("")}</ul>`,
    );
    listItems = [];
    listAlign = "left";
  }

  for (const line of lines) {
    const parsed = parseEmailLine(line);

    if (parsed.isBullet) {
      flushParagraph();
      if (listItems.length > 0 && parsed.align !== listAlign) {
        flushList();
      }
      listAlign = parsed.align;
      listItems.push(formatEmailInline(parsed.content));
      continue;
    }

    flushList();

    if (parsed.content.trim() === "") {
      flushParagraph();
      htmlParts.push("<br/>");
      continue;
    }

    if (paragraphLines.length > 0 && parsed.align !== paragraphAlign) {
      flushParagraph();
    }

    paragraphAlign = parsed.align;
    paragraphLines.push(parsed.content);
  }

  flushParagraph();
  flushList();

  return `<div style="${EMAIL_BODY_WRAPPER_STYLE}">${htmlParts.join("<br/>")}</div>`;
}
