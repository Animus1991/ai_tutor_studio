import type { Course } from './courseTypes';

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
}

const DEMO_CLASSROOM: ClassroomCourse[] = [
  { id: 'classroom-demo-psych', name: 'Intro to Psychology', section: 'Period 3' },
  { id: 'classroom-demo-algebra', name: 'Linear Algebra', section: 'Period 1' },
];

export async function fetchClassroomCourses(
  accessToken: string | null,
  isDemoMode: boolean
): Promise<ClassroomCourse[]> {
  if (isDemoMode || !accessToken || accessToken === 'demo-token') {
    await new Promise((r) => setTimeout(r, 600));
    return DEMO_CLASSROOM;
  }

  const res = await fetch(
    'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=30',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (res.status === 403) {
    throw new Error('Classroom access not granted. Sign out and sign in again to approve Classroom permissions.');
  }
  if (!res.ok) {
    throw new Error(`Classroom API error (${res.status})`);
  }

  const data = (await res.json()) as { courses?: Array<{ id: string; name?: string; section?: string }> };
  return (data.courses ?? []).map((c) => ({
    id: c.id,
    name: c.name ?? 'Untitled course',
    section: c.section,
  }));
}

/** Minimal local course shell for demo / offline library import. */
export function classroomCourseToLocalCourse(c: ClassroomCourse): Course {
  return {
    id: `classroom-${c.id}`,
    title: c.section ? `${c.name} (${c.section})` : c.name,
    topics: [
      {
        id: `${c.id}-welcome`,
        title: 'Classroom import',
        description: 'Imported from Google Classroom. Add study materials in the library to generate lessons.',
        objectives: ['Open workspace to attach PDFs or notes', 'Use AI tutor for guided review'],
        durationMinutes: 15,
      },
    ],
    glossary: [],
    prerequisites: [],
    uploadedFileIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
