/**
 * Annotation Span helpers — split a text body into plain/highlighted
 * segments given char-offset annotations, and resolve DOM selection
 * offsets relative to a container element.
 */

export type BodySpanSegment = {
  start: number;
  end: number;
  color?: string;
  annotationId?: string;
};

export function clampSpan(
  charStart: number,
  charEnd: number,
  bodyLength: number,
): { charStart: number; charEnd: number } {
  const start = Math.max(0, Math.min(charStart, bodyLength));
  const end = Math.max(start, Math.min(charEnd, bodyLength));
  return { charStart: start, charEnd: end };
}

/** Split a body into plain vs highlighted segments (body-local offsets). */
export function segmentBodySpans(
  bodyLength: number,
  spans: { charStart: number; charEnd: number; color: string; id: string }[],
): BodySpanSegment[] {
  const relevant = spans
    .map((s) => {
      const { charStart, charEnd } = clampSpan(s.charStart, s.charEnd, bodyLength);
      return { ...s, charStart, charEnd };
    })
    .filter((s) => s.charEnd > s.charStart)
    .sort((a, b) => a.charStart - b.charStart);

  const segments: BodySpanSegment[] = [];
  let cursor = 0;

  for (const span of relevant) {
    if (span.charStart > cursor) {
      segments.push({ start: cursor, end: span.charStart });
    }
    if (span.charEnd > span.charStart) {
      segments.push({
        start: span.charStart,
        end: span.charEnd,
        color: span.color,
        annotationId: span.id,
      });
    }
    cursor = Math.max(cursor, span.charEnd);
  }
  if (cursor < bodyLength) segments.push({ start: cursor, end: bodyLength });
  return segments;
}

/** DOM helper — offsets relative to element text content. */
export function getSelectionOffsetsInElement(el: HTMLElement): { start: number; end: number } | null {
  if (typeof window === 'undefined') return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return null;

  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  pre.setEnd(range.endContainer, range.endOffset);
  const end = pre.toString().length;
  if (end <= start) return null;
  return { start, end };
}
