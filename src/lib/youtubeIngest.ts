const YOUTUBE_HOST = /youtube\.com|youtu\.be/i;

/** Parse newline- or comma-separated YouTube URLs from user input. */
export function parseYoutubeUrls(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => YOUTUBE_HOST.test(s))
    .filter((s) => {
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });
}

export function extractYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.slice(1).split('/')[0] || null;
    }
    if (u.searchParams.get('v')) {
      return u.searchParams.get('v');
    }
    const parts = u.pathname.split('/');
    const idx = parts.indexOf('shorts');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    const embedIdx = parts.indexOf('embed');
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
  } catch {
    return null;
  }
  return null;
}

export type YoutubeBatchResult = {
  url: string;
  videoId?: string;
  title?: string;
  text?: string;
  error?: string;
};
