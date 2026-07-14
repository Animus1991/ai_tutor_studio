/**
 * Reader Math Rendering — detects delimited LaTeX math ($…$, \(…\), \[…\])
 * inside reader body text and renders it via KaTeX, leaving everything
 * else as plain text (optionally with a focus-term highlight).
 */
import type { ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const MATH_DELIM = /\$\$([^$]+)\$\$|\$([^$\n]+)\$|\\\[([^\]]+)\\\]|\\\(([^)]+)\\\)/g;

function renderKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex.trim(), { throwOnError: false, displayMode, output: 'html' });
  } catch {
    return latex;
  }
}

export type TextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'math'; latex: string; display: boolean };

/** Split raw text into plain-text and math segments (delimited LaTeX only). */
export function splitMathSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  MATH_DELIM.lastIndex = 0;
  while ((match = MATH_DELIM.exec(text)) !== null) {
    if (match.index > cursor) segments.push({ kind: 'text', text: text.slice(cursor, match.index) });
    const display = match[1] !== undefined;
    const latex = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
    segments.push({ kind: 'math', latex, display });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}

export function hasMathContent(text: string): boolean {
  MATH_DELIM.lastIndex = 0;
  return MATH_DELIM.test(text);
}

interface MathTextProps {
  text: string;
  /** Optional render function for plain-text sub-segments (e.g. focus-term highlight). */
  renderText?: (text: string) => ReactNode;
}

export function MathText({ text, renderText }: MathTextProps) {
  const segments = splitMathSegments(text);
  if (segments.length === 1 && segments[0]!.kind === 'text') {
    return <>{renderText ? renderText(text) : text}</>;
  }
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') return <span key={i}>{renderText ? renderText(seg.text) : seg.text}</span>;
        return (
          <span
            key={i}
            className={seg.display ? 'block my-1.5 overflow-x-auto' : 'inline-block'}
            dangerouslySetInnerHTML={{ __html: renderKatex(seg.latex, seg.display) }}
          />
        );
      })}
    </>
  );
}
