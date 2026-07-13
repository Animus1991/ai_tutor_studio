/**
 * Reader Text-to-Speech — sequential paragraph playback via the native
 * Web Speech API, with scroll-follow callbacks so the UI can highlight
 * the paragraph currently being read.
 */

export type ReaderTtsOptions = {
  lang: 'en' | 'el';
  rate?: number;
  onParagraphStart?: (index: number) => void;
  onEnd?: () => void;
};

export type ReaderTtsController = {
  stop: () => void;
  pause: () => void;
  resume: () => void;
};

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}

/** Split a section body into speakable paragraphs, stripping delimited math. */
export function toSpeakableParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.replace(/\$\$?([^$]+)\$\$?|\\\[([^\]]+)\\\]|\\\(([^)]+)\\\)/g, ' formula ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function speakParagraphs(
  paragraphs: string[],
  opts: ReaderTtsOptions,
): ReaderTtsController | null {
  if (!isTtsSupported()) return null;
  const filtered = paragraphs.map((p) => p.trim()).filter(Boolean);
  if (filtered.length === 0) return null;

  let cancelled = false;
  const utterLang = opts.lang === 'el' ? 'el-GR' : 'en-US';

  const speakAt = (i: number) => {
    if (cancelled || i >= filtered.length) {
      opts.onEnd?.();
      return;
    }
    opts.onParagraphStart?.(i);
    const u = new SpeechSynthesisUtterance(filtered[i]!);
    u.lang = utterLang;
    u.rate = opts.rate ?? 1;
    u.onend = () => speakAt(i + 1);
    u.onerror = () => speakAt(i + 1);
    window.speechSynthesis.speak(u);
  };

  window.speechSynthesis.cancel();
  speakAt(0);

  return {
    stop: () => {
      cancelled = true;
      window.speechSynthesis.cancel();
    },
    pause: () => window.speechSynthesis.pause(),
    resume: () => window.speechSynthesis.resume(),
  };
}
