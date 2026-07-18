/**
 * Upload validation spine — magic-byte MIME sniff + extract budgets.
 * Auth → Validate → Authorize → Moderate → Persist …
 */
import { HttpError } from './security.js';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_EXTRACT_CHARS = Number(process.env.MAX_EXTRACT_CHARS) || 200_000;
export const MAX_PDF_PAGES = Number(process.env.MAX_PDF_PAGES) || 80;
export const MAX_OCR_IMAGE_BYTES = Number(process.env.MAX_OCR_IMAGE_BYTES) || 8 * 1024 * 1024;

export type SniffedMime =
  | 'application/pdf'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/gif'
  | 'audio/webm'
  | 'audio/ogg'
  | 'audio/mpeg'
  | 'text/plain'
  | 'application/zip'
  | 'unknown';

/** Magic-byte sniff (defense-in-depth vs client-declared mimetype). */
export function sniffMime(buffer: Buffer): SniffedMime {
  if (!buffer || buffer.length < 4) return 'unknown';
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf'; // %PDF
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return 'audio/webm'; // EBML (webm/mkv)
  }
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return 'audio/ogg';
  }
  if (
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) ||
    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)
  ) {
    return 'audio/mpeg';
  }
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05)) {
    return 'application/zip'; // docx/pptx/xlsx OOXML
  }
  // Heuristic: mostly printable → text
  const sample = buffer.subarray(0, Math.min(512, buffer.length));
  let printable = 0;
  for (const b of sample) {
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 160) printable += 1;
  }
  if (printable / sample.length > 0.85) return 'text/plain';
  return 'unknown';
}

function normalizeDeclared(mime: string): string {
  return mime.split(';')[0]?.trim().toLowerCase() || 'application/octet-stream';
}

function mimeFamily(mime: string): 'pdf' | 'image' | 'audio' | 'text' | 'office' | 'other' {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/') || mime === 'application/json') return 'text';
  if (
    mime.includes('wordprocessingml') ||
    mime.includes('presentationml') ||
    mime.includes('spreadsheetml') ||
    mime.includes('opendocument') ||
    mime === 'application/rtf' ||
    mime === 'application/msword' ||
    mime === 'application/zip'
  ) {
    return 'office';
  }
  return 'other';
}

export type UploadGuardKind = 'ingest' | 'ocr' | 'media' | 'audio';

/**
 * Validate declared MIME against sniffed bytes for the upload surface.
 * Returns the MIME to use for downstream processing.
 */
export function assertUploadAllowed(
  buffer: Buffer,
  declaredMime: string,
  kind: UploadGuardKind,
): { mime: string; sniffed: SniffedMime } {
  if (!buffer?.length) throw new HttpError(400, 'Empty upload');
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, `File exceeds ${MAX_UPLOAD_BYTES} bytes`);
  }
  const declared = normalizeDeclared(declaredMime);
  const sniffed = sniffMime(buffer);
  const declaredFamily = mimeFamily(declared);
  const sniffedFamily = mimeFamily(sniffed === 'unknown' ? declared : sniffed);

  if (kind === 'ocr') {
    if (buffer.length > MAX_OCR_IMAGE_BYTES) {
      throw new HttpError(413, `OCR image exceeds ${MAX_OCR_IMAGE_BYTES} bytes`);
    }
    if (declaredFamily !== 'image' && sniffedFamily !== 'image') {
      throw new HttpError(400, 'Only image files are supported for OCR');
    }
    if (sniffedFamily === 'image' && declaredFamily !== 'image' && sniffed !== 'unknown') {
      throw new HttpError(400, `MIME mismatch: declared ${declared}, sniffed ${sniffed}`);
    }
  }

  if (kind === 'audio') {
    if (declaredFamily !== 'audio' && sniffedFamily !== 'audio' && sniffed !== 'unknown') {
      // Browsers often send audio/webm; EBML sniff covers webm
      if (!(declared.startsWith('audio/') || declared === 'video/webm')) {
        throw new HttpError(400, 'Only audio uploads are supported for transcription');
      }
    }
  }

  if (kind === 'media') {
    const ok =
      declaredFamily === 'image' ||
      declaredFamily === 'audio' ||
      declared.startsWith('video/') ||
      sniffedFamily === 'image' ||
      sniffedFamily === 'audio';
    if (!ok) throw new HttpError(400, 'Only image, video, or audio files are supported');
  }

  if (kind === 'ingest') {
    const ok =
      declaredFamily === 'pdf' ||
      declaredFamily === 'text' ||
      declaredFamily === 'image' ||
      declaredFamily === 'office' ||
      sniffedFamily === 'pdf' ||
      sniffedFamily === 'text' ||
      sniffedFamily === 'image' ||
      sniffedFamily === 'office';
    if (!ok) {
      throw new HttpError(
        400,
        'Unsupported file type. Upload text, PDF, image, Word, PowerPoint, spreadsheet, OpenDocument, or RTF material.',
      );
    }
    // Hard reject: declared PDF but bytes are not PDF (and not unknown text)
    if (declaredFamily === 'pdf' && sniffed !== 'application/pdf' && sniffed !== 'unknown') {
      throw new HttpError(400, `MIME mismatch: declared PDF, sniffed ${sniffed}`);
    }
    if (declaredFamily === 'image' && sniffedFamily !== 'image' && sniffed !== 'unknown') {
      throw new HttpError(400, `MIME mismatch: declared ${declared}, sniffed ${sniffed}`);
    }
  }

  const mime =
    sniffed !== 'unknown' && mimeFamily(sniffed) === declaredFamily ? sniffed : declared;
  return { mime, sniffed };
}

/** Truncate extracted text to budget; count form-feed as page breaks. */
export function enforceExtractBudgets(
  text: string,
  opts: { pageCount?: number } = {},
): { text: string; truncated: boolean; pageCount: number } {
  const pageCount =
    opts.pageCount ??
    Math.max(1, (text.match(/\f/g)?.length ?? 0) + 1);
  if (pageCount > MAX_PDF_PAGES) {
    throw new HttpError(
      413,
      `Document exceeds max pages (${MAX_PDF_PAGES}). Split the file and re-upload.`,
    );
  }
  if (text.length <= MAX_EXTRACT_CHARS) {
    return { text, truncated: false, pageCount };
  }
  return {
    text: text.slice(0, MAX_EXTRACT_CHARS),
    truncated: true,
    pageCount,
  };
}
