import { describe, expect, it } from 'vitest';
import { heuristicModerateText } from './matchModeratorHeuristics';

describe('matchModerator heuristics', () => {
  it('allows normal study chat', () => {
    const v = heuristicModerateText('Can you quiz me on organic chem mechanisms?');
    expect(v.allowed).toBe(true);
  });

  it('rejects sexual and nude content', () => {
    expect(heuristicModerateText('send nudes').allowed).toBe(false);
    expect(heuristicModerateText('you look sexy').category).toMatch(/sexual|nude/);
    expect(heuristicModerateText('γυμνές φωτογραφίες').allowed).toBe(false);
  });

  it('rejects dating / flirting pivots', () => {
    expect(heuristicModerateText('are you a girl and single?').allowed).toBe(false);
    expect(heuristicModerateText('what do you look like').allowed).toBe(false);
  });

  it('rejects off-platform contact', () => {
    expect(heuristicModerateText('add me on whatsapp').allowed).toBe(false);
  });
});
