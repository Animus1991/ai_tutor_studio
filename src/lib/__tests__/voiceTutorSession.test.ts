import { describe, expect, it } from 'vitest';
import {
  nextPhaseOnMic,
  offlineVoiceReply,
  pruneExpiredTurns,
  VOICE_TURN_TTL_MS,
  latencyWithinBudget,
} from '../voiceTutorSession';

describe('voiceTutorSession', () => {
  it('supports barge-in speaking → listening', () => {
    expect(nextPhaseOnMic('speaking', false)).toBe('listening');
    expect(nextPhaseOnMic('listening', true)).toBe('toggle_stop');
    expect(nextPhaseOnMic('idle', false)).toBe('listening');
  });

  it('prunes turns older than TTL', () => {
    const now = Date.now();
    const kept = pruneExpiredTurns(
      [
        { id: '1', role: 'user', content: 'old', at: now - VOICE_TURN_TTL_MS - 1000 },
        { id: '2', role: 'model', content: 'fresh', at: now },
      ],
      now,
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]?.id).toBe('2');
  });

  it('checks latency budgets', () => {
    expect(latencyWithinBudget('stt', 1000)).toBe(true);
    expect(latencyWithinBudget('stt', 99_000)).toBe(false);
  });

  it('returns offline local prompts without inventing live answers', () => {
    expect(offlineVoiceReply('explain photosynthesis', 'en')).toMatch(/offline|Feynman/i);
    expect(offlineVoiceReply('fsrs review', 'el')).toMatch(/FSRS|retrieval|Offline/i);
  });
});
