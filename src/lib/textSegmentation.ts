export type SectionKind = 'heading' | 'paragraph' | 'page' | 'conversation' | 'list';

export interface DocumentSection {
  id: string;
  title: string;
  body: string;
  kind: SectionKind;
  startOffset: number;
}

const HEADING_RE = /^(?:#{1,6}\s+|(?:chapter|section|κεφάλαιο|διάλεξη|lecture)\s+\d|[\d]+\.\s+[A-ZΑ-Ω])/i;
const CONVERSATION_RE = /^(?:User|Assistant|Q|A|Student|Teacher):\s/i;

export function detectDocumentSections(text: string): DocumentSection[] {
  if (!text.trim()) return [];

  const blocks = text.split(/\f|\n(?=#{1,3}\s)|\n(?=[A-ZΑ-Ω][^\n]{0,80}\n={3,})|\n(?=\d+\.\s+[A-ZΑ-Ω])/);
  const sections: DocumentSection[] = [];
  let offset = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (block.length < 20) {
      offset += blocks[i].length + 1;
      continue;
    }

    const lines = block.split('\n');
    const firstLine = lines[0]?.trim() ?? '';
    let kind: SectionKind = 'paragraph';
    let title = `Section ${sections.length + 1}`;

    if (HEADING_RE.test(firstLine)) {
      kind = 'heading';
      title = firstLine.replace(/^#+\s*/, '').slice(0, 120);
    } else if (CONVERSATION_RE.test(firstLine)) {
      kind = 'conversation';
      title = firstLine.slice(0, 80);
    } else if (block.includes('\f')) {
      kind = 'page';
      title = `Page ${sections.length + 1}`;
    } else if (/^[-*•]\s/m.test(block)) {
      kind = 'list';
      title = firstLine.slice(0, 80) || `List ${sections.length + 1}`;
    }

    sections.push({
      id: `sec-${i}`,
      title,
      body: block,
      kind,
      startOffset: offset,
    });
    offset += blocks[i].length + 1;
  }

  if (sections.length === 0 && text.trim().length >= 80) {
    sections.push({
      id: 'sec-0',
      title: 'Document',
      body: text.trim(),
      kind: 'paragraph',
      startOffset: 0,
    });
  }

  return sections;
}

export function splitStructuredParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30);
}
