import { describe, it, expect } from 'vitest';
import { buildStudyActivityData, averageFocusMinutes } from '../studySessionAnalytics';
import { buildQuizSetFromNotes, shuffleQuizQuestion } from '../groundedLesson';
import type { WorkspaceNoteBundle } from '../workspaceNoteContent';

describe('studySessionAnalytics', () => {
  it('builds 7-day activity from focus sessions', () => {
    const today = new Date().toISOString();
    const data = buildStudyActivityData(
      [{ date: today, duration: 45, type: 'focus' }],
      60,
    );
    expect(data).toHaveLength(7);
    expect(data[6].studyTime).toBe(45);
    expect(data[6].goalTime).toBe(60);
    expect(averageFocusMinutes(data)).toBeGreaterThan(0);
  });
});

describe('quiz helpers', () => {
  const bundle: WorkspaceNoteBundle = {
    hasSource: true,
    concept: 'Test',
    sourceText: 'sample',
    formulas: [],
    course: {
      id: 'c1',
      title: 'Test Course',
      glossary: [
        { term: 'Alpha', definition: 'First term' },
        { term: 'Beta', definition: 'Second term' },
        { term: 'Gamma', definition: 'Third term' },
      ],
      topics: [],
    },
  } as WorkspaceNoteBundle;

  it('builds multiple quiz questions from glossary', () => {
    const set = buildQuizSetFromNotes(bundle);
    expect(set.length).toBeGreaterThanOrEqual(2);
    expect(set[0].question).toContain('Alpha');
  });

  it('shuffleQuizQuestion preserves one correct answer', () => {
    const q = {
      id: 'q1',
      question: 'Test?',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
    };
    const shuffled = shuffleQuizQuestion(q);
    expect(shuffled.options).toHaveLength(4);
    expect(shuffled.options[shuffled.correctIndex]).toBe('A');
  });
});
