import { describe, it, expect } from 'vitest';
import { parseYoutubeUrls, extractYoutubeVideoId } from '../youtubeIngest';

describe('youtubeIngest', () => {
  it('parses multiple URLs from newline input', () => {
    const raw = `https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/abc12345678`;
    expect(parseYoutubeUrls(raw)).toHaveLength(2);
  });

  it('deduplicates URLs', () => {
    const url = 'https://youtu.be/abc12345678';
    expect(parseYoutubeUrls(`${url}\n${url}`)).toHaveLength(1);
  });

  it('extracts video id from watch URL', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts video id from youtu.be', () => {
    expect(extractYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
});
