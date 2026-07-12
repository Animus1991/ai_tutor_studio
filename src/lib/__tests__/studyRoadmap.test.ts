import { describe, expect, it } from 'vitest';
import { buildStudyRoadmapMilestones, roadmapProgressPercent } from '../studyRoadmap';

describe('studyRoadmap', () => {
  it('marks first incomplete task as active', () => {
    const milestones = buildStudyRoadmapMilestones([
      { id: '1', title: 'Done', completed: true, createdAt: '2026-07-10T10:00:00Z' },
      { id: '2', title: 'Next', completed: false, createdAt: '2026-07-12T10:00:00Z' },
      { id: '3', title: 'Later', completed: false, createdAt: '2026-07-14T10:00:00Z' },
    ]);
    expect(milestones.find((m) => m.id === '2')?.status).toBe('active');
    expect(milestones.find((m) => m.id === '3')?.status).toBe('pending');
  });

  it('computes progress percent', () => {
    const milestones = buildStudyRoadmapMilestones([
      { id: '1', title: 'A', completed: true },
      { id: '2', title: 'B', completed: false },
    ]);
    expect(roadmapProgressPercent(milestones)).toBe(50);
  });
});
