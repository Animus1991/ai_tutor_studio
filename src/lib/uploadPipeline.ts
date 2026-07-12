import { analyzeContentToOutline } from './contentAnalysis';
import { adaptOutlineToSourceQuality, analyzeCourseSourceQuality } from './courseSourceQuality';
import type { Course, CourseOutline, UploadedFile } from './courseTypes';

export const PIPELINE_VERSION = '2.0.0';

export async function extractFileContent(file: File): Promise<string> {
  const mime = file.type || 'application/octet-stream';

  if (mime.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
    return normalizeDocumentText(await file.text());
  }

  if (mime === 'application/pdf' || file.name.endsWith('.pdf')) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/ingest/file', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Failed to extract PDF text');
    const data = await res.json();
    return normalizeDocumentText(data.text ?? '');
  }

  if (mime.startsWith('image/')) {
    return `[Image: ${file.name}] — OCR processing recommended for scanned content.`;
  }

  throw new Error(`Unsupported file type: ${mime || file.name}`);
}

export function normalizeDocumentText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n--- page break ---\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export function buildCourseFromOutline(
  outline: CourseOutline,
  fileIds: string[],
  existingId?: string,
): Course {
  const now = new Date().toISOString();
  return {
    id: existingId ?? crypto.randomUUID(),
    title: outline.title,
    topics: outline.topics,
    glossary: outline.glossary,
    prerequisites: outline.prerequisites,
    uploadedFileIds: fileIds,
    createdAt: now,
    updatedAt: now,
  };
}

export function mergeOutlineIntoCourse(course: Course, outline: CourseOutline): Course {
  const existingTitles = new Set(course.topics.map((t) => t.title.toLowerCase()));
  const newTopics = outline.topics.filter((t) => !existingTitles.has(t.title.toLowerCase()));
  const glossaryMap = new Map(course.glossary.map((g) => [g.term.toLowerCase(), g]));
  for (const g of outline.glossary) glossaryMap.set(g.term.toLowerCase(), g);

  return {
    ...course,
    topics: [...course.topics, ...newTopics],
    glossary: [...glossaryMap.values()],
    prerequisites: [...new Set([...course.prerequisites, ...outline.prerequisites])],
    updatedAt: new Date().toISOString(),
  };
}

export function processTextToCourse(
  text: string,
  fileName: string,
  fileId: string,
): { course: Course; file: UploadedFile; quality: ReturnType<typeof analyzeCourseSourceQuality> } {
  let outline = analyzeContentToOutline(text, fileName);
  let quality = analyzeCourseSourceQuality(text, outline);
  if (outline.topics.length > quality.recommendedTopicCount) {
    outline = adaptOutlineToSourceQuality(outline, quality);
    quality = { ...quality, finalTopicCount: outline.topics.length, outlineAdjusted: true };
  }

  const file: UploadedFile = {
    id: fileId,
    name: fileName,
    extractedText: text,
    pipelineVersion: PIPELINE_VERSION,
    createdAt: new Date().toISOString(),
  };

  const course = buildCourseFromOutline(outline, [fileId]);
  course.sourceQuality = quality;

  return { course, file, quality };
}
