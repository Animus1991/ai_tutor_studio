/**
 * Lightweight Markdown renderer for AI chat messages.
 * Supports: headings, bold, italic, inline-code, fenced code blocks,
 *           ordered/unordered lists, blockquotes, links, horizontal rules.
 * No external deps — intentionally self-contained.
 */
import { useState, useCallback } from 'react';
import { Check, Copy, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  content: string;
  className?: string;
}

/* ─── Token types ─────────────────────────────────────────────── */
type Token =
  | { type: 'heading';    depth: 1|2|3; text: string }
  | { type: 'hr' }
  | { type: 'code';       lang: string; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'ul';         items: string[] }
  | { type: 'ol';         items: string[] }
  | { type: 'paragraph';  text: string };

/* ─── Block-level tokeniser ───────────────────────────────────── */
function tokenize(md: string): Token[] {
  const lines = md.split('\n');
  const tokens: Token[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fenceMatch = line.match(/^```(\w*)/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      tokens.push({ type: 'code', lang, text: codeLines.join('\n') });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const depth = Math.min(headingMatch[1].length, 3) as 1|2|3;
      tokens.push({ type: 'heading', depth, text: headingMatch[2] });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$|^\*\*\*+$/.test(line.trim())) {
      tokens.push({ type: 'hr' });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bqLines.push(lines[i].slice(2));
        i++;
      }
      tokens.push({ type: 'blockquote', text: bqLines.join('\n') });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s/, ''));
        i++;
      }
      tokens.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      tokens.push({ type: 'ol', items });
      continue;
    }

    // Empty line → skip
    if (line.trim() === '') { i++; continue; }

    // Paragraph (collect until blank line or block element)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3}\s|```|---|\*\*\*|> |[-*+]\s|\d+\.\s)/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      tokens.push({ type: 'paragraph', text: paraLines.join('\n') });
    }
  }

  return tokens;
}

/* ─── Inline renderer (bold, italic, code, links) ─────────────── */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Combined regex: **bold**, *italic*, `code`, [text](url), __bold__, _italic_
  const re = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }
    if (m[1]) {
      parts.push(<strong key={key++}>{m[2]}</strong>);
    } else if (m[3]) {
      parts.push(<em key={key++}>{m[4]}</em>);
    } else if (m[5] !== undefined) {
      parts.push(<code key={key++}>{m[5]}</code>);
    } else if (m[6] && m[7]) {
      parts.push(<a key={key++} href={m[7]} target="_blank" rel="noreferrer">{m[6]}</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* ─── Code block with copy + collapse ─────────────────────────── */
function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(text.split('\n').length > 20);
  const lines = text.split('\n');
  const preview = lines.slice(0, 12).join('\n');

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [text]);

  return (
    <div className="relative group my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 rounded-t-[10px] border border-slate-700 border-b-0">
        <span className="text-xs font-mono text-slate-400 font-medium">{lang || 'code'}</span>
        <div className="flex items-center gap-1.5">
          {lines.length > 20 && (
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors px-1.5 py-0.5 rounded"
            >
              {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              {collapsed ? `+${lines.length - 12} lines` : 'Collapse'}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors px-1.5 py-0.5 rounded"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="!mt-0 !rounded-t-none">
        <code>{collapsed ? preview + (lines.length > 12 ? '\n…' : '') : text}</code>
      </pre>
    </div>
  );
}

/* ─── Main renderer ─────────────────────────────────────────────── */
export default function MarkdownMessage({ content, className = '' }: Props) {
  const tokens = tokenize(content);

  return (
    <div className={`prose-chat ${className}`}>
      {tokens.map((tok, i) => {
        switch (tok.type) {
          case 'heading': {
            const Tag = `h${tok.depth}` as 'h1'|'h2'|'h3';
            return <Tag key={i}>{renderInline(tok.text)}</Tag>;
          }
          case 'hr':
            return <hr key={i} />;
          case 'code':
            return <CodeBlock key={i} lang={tok.lang} text={tok.text} />;
          case 'blockquote':
            return <blockquote key={i}>{renderInline(tok.text)}</blockquote>;
          case 'ul':
            return (
              <ul key={i}>
                {tok.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i}>
                {tok.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ol>
            );
          case 'paragraph':
          default:
            return (
              <p key={i}>
                {renderInline((tok as { type: 'paragraph'; text: string }).text)}
              </p>
            );
        }
      })}
    </div>
  );
}
