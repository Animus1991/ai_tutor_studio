import { describe, expect, it } from 'vitest';
import {
  classroomCourseToLocalCourse,
  fetchClassroomCourses,
} from '../classroomService';

describe('classroomService', () => {
  it('returns demo courses in demo mode', async () => {
    const courses = await fetchClassroomCourses('demo-token', true);
    expect(courses.length).toBeGreaterThanOrEqual(2);
    expect(courses[0].name).toBeTruthy();
  });

  it('maps classroom course to local course shell', () => {
    const course = classroomCourseToLocalCourse({
      id: '123',
      name: 'Biology',
      section: 'A',
    });
    expect(course.id).toBe('classroom-123');
    expect(course.title).toContain('Biology');
    expect(course.topics.length).toBeGreaterThan(0);
  });
});
