"use client";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  Underline,
} from "lucide-react";
import { useRef, type ReactNode, type RefObject } from "react";
import {
  EMAIL_ALIGN_LINE_PREFIX,
  EMAIL_ALIGN_LINE_PREFIX_RE,
  type EmailTextAlign,
} from "@/lib/email/plain-text-email-html";

type Props = {
  id: string;
  name: string;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  defaultValue?: string;
  hint?: string;
};

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder = "text",
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end) || placeholder;
  const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
  textarea.value = next;
  const cursorStart = start + before.length;
  const cursorEnd = cursorStart + selected.length;
  textarea.focus();
  textarea.setSelectionRange(cursorStart, cursorEnd);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function insertAtLineStarts(textarea: HTMLTextAreaElement, prefix: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = value.indexOf("\n", end);
  const blockEnd = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, blockEnd);
  const lines = block.split("\n");
  const prefixed = lines
    .map((line, index) => {
      if (index === 0 && line.trim() === "" && lines.length === 1) {
        return prefix;
      }
      return line.startsWith(prefix) ? line : `${prefix}${line}`;
    })
    .join("\n");
  const next = `${value.slice(0, lineStart)}${prefixed}${value.slice(blockEnd)}`;
  textarea.value = next;
  textarea.focus();
  textarea.setSelectionRange(lineStart, lineStart + prefixed.length);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function setLineAlignment(textarea: HTMLTextAreaElement, align: EmailTextAlign) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = value.indexOf("\n", end);
  const blockEnd = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, blockEnd);
  const newPrefix = EMAIL_ALIGN_LINE_PREFIX[align];
  const aligned = block
    .split("\n")
    .map((line) => `${newPrefix}${line.replace(EMAIL_ALIGN_LINE_PREFIX_RE, "")}`)
    .join("\n");
  const next = `${value.slice(0, lineStart)}${aligned}${value.slice(blockEnd)}`;
  textarea.value = next;
  textarea.focus();
  textarea.setSelectionRange(lineStart, lineStart + aligned.length);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function insertMarkdownLink(textarea: HTMLTextAreaElement) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end) || "link text";
  const url =
    typeof window !== "undefined"
      ? window.prompt("Link URL (https://…)", "https://")
      : "https://";
  if (!url?.trim()) return;
  const next = `${value.slice(0, start)}[${selected}](${url.trim()})${value.slice(end)}`;
  textarea.value = next;
  textarea.focus();
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/10 bg-background text-foreground/80 hover:bg-foreground/[0.04] hover:text-foreground"
    >
      {children}
    </button>
  );
}

function FormatToolbar({ textareaRef }: { textareaRef: RefObject<HTMLTextAreaElement | null> }) {
  const textarea = () => textareaRef.current;

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 border-foreground/15 bg-foreground/[0.03] px-2 py-1.5">
      <ToolbarButton
        label="Bold"
        onClick={() => {
          const el = textarea();
          if (el) wrapSelection(el, "**", "**");
        }}
      >
        <Bold className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        onClick={() => {
          const el = textarea();
          if (el) wrapSelection(el, "*", "*");
        }}
      >
        <Italic className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        onClick={() => {
          const el = textarea();
          if (el) wrapSelection(el, "__", "__");
        }}
      >
        <Underline className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Insert link"
        onClick={() => {
          const el = textarea();
          if (el) insertMarkdownLink(el);
        }}
      >
        <Link2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Bullet list"
        onClick={() => {
          const el = textarea();
          if (el) insertAtLineStarts(el, "- ");
        }}
      >
        <List className="h-4 w-4" aria-hidden />
      </ToolbarButton>

      <span className="mx-1 h-6 w-px bg-foreground/15" aria-hidden />

      <ToolbarButton
        label="Align left"
        onClick={() => {
          const el = textarea();
          if (el) setLineAlignment(el, "left");
        }}
      >
        <AlignLeft className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Align center"
        onClick={() => {
          const el = textarea();
          if (el) setLineAlignment(el, "center");
        }}
      >
        <AlignCenter className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Align right"
        onClick={() => {
          const el = textarea();
          if (el) setLineAlignment(el, "right");
        }}
      >
        <AlignRight className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Justify"
        onClick={() => {
          const el = textarea();
          if (el) setLineAlignment(el, "justify");
        }}
      >
        <AlignJustify className="h-4 w-4" aria-hidden />
      </ToolbarButton>
    </div>
  );
}

export function FormattedEmailBodyField({
  id,
  name,
  required,
  rows = 8,
  placeholder,
  defaultValue,
  hint,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div>
      <FormatToolbar textareaRef={textareaRef} />
      <textarea
        ref={textareaRef}
        id={id}
        name={name}
        required={required}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-b-md rounded-t-none border border-foreground/15 bg-background px-3 py-2 text-sm outline-none ring-brand/40 placeholder:text-foreground/45 focus:ring-2"
      />
      <p className="mt-1 text-xs text-muted">
        {hint ??
          "Use the toolbar for formatting, alignment, links, and bullet lists. Select lines before choosing left, center, right, or justify. Plain https:// links are also clickable."}
      </p>
    </div>
  );
}
