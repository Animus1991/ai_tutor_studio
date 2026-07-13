/**
 * Annotation Store — persisted text annotations (highlight/comment) per
 * workspace section. Anchored via char offsets + a stored excerpt so
 * annotations can be re-resolved if the underlying text shifts slightly.
 */

export type AnnotationCategory = 'general' | 'confusing' | 'exam-relevant' | 'important' | 'definition';
export type AnnotationType = 'highlight' | 'comment';
export type AnnotationAnchorStatus = 'ok' | 'needs-review';

export interface StoredAnnotation {
  id: string;
  sectionId: string;
  type: AnnotationType;
  /** Highlight color (hex) */
  color: string;
  /** Comment/note text (empty for plain highlights) */
  note: string;
  /** Char offsets local to the section body */
  charStart: number;
  charEnd: number;
  /** Snapshot of the highlighted text, used to re-anchor after edits */
  excerpt: string;
  category: AnnotationCategory;
  anchorStatus: AnnotationAnchorStatus;
  createdAt: number;
}

const STORAGE_PREFIX = 'synapse:annotations:';

function storageKey(progressKey: string): string {
  return `${STORAGE_PREFIX}${progressKey}`;
}

export function loadAnnotations(progressKey: string): StoredAnnotation[] {
  try {
    const json = localStorage.getItem(storageKey(progressKey));
    if (!json) return [];
    return JSON.parse(json) as StoredAnnotation[];
  } catch {
    return [];
  }
}

export function saveAnnotations(progressKey: string, items: StoredAnnotation[]): void {
  try {
    localStorage.setItem(storageKey(progressKey), JSON.stringify(items));
  } catch {
    // Storage quota exceeded — silently fail
  }
}

export function annotationsForSection(items: StoredAnnotation[], sectionId: string): StoredAnnotation[] {
  return items.filter((a) => a.sectionId === sectionId);
}

/**
 * Re-anchor an annotation against a (possibly edited) body. If the stored
 * excerpt still exists verbatim, snap offsets to its new position; otherwise
 * flag for review while keeping the last-known offsets as a best guess.
 */
export function reanchorAnnotation(ann: StoredAnnotation, body: string): StoredAnnotation {
  const current = body.slice(ann.charStart, ann.charEnd);
  if (current === ann.excerpt) return { ...ann, anchorStatus: 'ok' };
  const idx = ann.excerpt ? body.indexOf(ann.excerpt) : -1;
  if (idx >= 0) {
    return { ...ann, charStart: idx, charEnd: idx + ann.excerpt.length, anchorStatus: 'ok' };
  }
  return { ...ann, anchorStatus: 'needs-review' };
}

export function reanchorSectionAnnotations(
  items: StoredAnnotation[],
  sectionId: string,
  body: string,
): StoredAnnotation[] {
  return items.map((a) => (a.sectionId === sectionId ? reanchorAnnotation(a, body) : a));
}

export function exportAnnotationsMarkdown(sourceName: string, items: StoredAnnotation[]): string {
  const header = `# Annotations${sourceName ? ` — ${sourceName}` : ''}\n\nExported: ${new Date().toISOString()}\n`;
  const body = items
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((a) => {
      const parts = [
        `## ${a.type}${a.category !== 'general' ? ` · ${a.category}` : ''}`,
        a.excerpt ? `> ${a.excerpt}` : '',
        a.note ? a.note : '',
        a.anchorStatus !== 'ok' ? `**Status:** ${a.anchorStatus}` : '',
      ].filter(Boolean);
      return parts.join('\n\n');
    })
    .join('\n\n---\n\n');
  return `${header}\n${body}`;
}
