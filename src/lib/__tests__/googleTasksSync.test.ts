import { describe, expect, it } from 'vitest';
import { mergeTasksLastWriteWins, googleTaskToLocal } from '../googleTasksSync';

describe('googleTasksSync LWW', () => {
  it('maps google rows', () => {
    const local = googleTaskToLocal({
      id: 'g1',
      title: 'Review IRT',
      status: 'needsAction',
      updated: '2026-01-01T00:00:00.000Z',
    });
    expect(local.googleTaskId).toBe('g1');
    expect(local.completed).toBe(false);
  });

  it('pushes unmatched local tasks and pulls unmatched remote', () => {
    const result = mergeTasksLastWriteWins(
      [{ id: 'l1', title: 'Local only', updatedAt: 100 }],
      [{ id: 'r1', title: 'Remote only', updated: '2026-01-02T00:00:00.000Z' }],
    );
    expect(result.toPush).toHaveLength(1);
    expect(result.toPull).toHaveLength(1);
    expect(result.merged).toHaveLength(2);
  });

  it('prefers newer side on conflict', () => {
    const result = mergeTasksLastWriteWins(
      [
        {
          id: 'l1',
          title: 'Shared',
          googleTaskId: 'g1',
          updatedAt: '2026-06-01T00:00:00.000Z',
          notes: 'local',
        },
      ],
      [
        {
          id: 'g1',
          title: 'Shared',
          notes: 'google',
          updated: '2026-01-01T00:00:00.000Z',
        },
      ],
    );
    expect(result.conflicts[0]?.winner).toBe('local');
    expect(result.toPush[0]?.notes).toBe('local');
  });
});
