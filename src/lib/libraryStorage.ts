import localforage from 'localforage';
import type { Course, UploadedFile } from './courseTypes';

const LIBRARY_KEY = 'memora:library-v1';

export interface LibraryState {
  courses: Course[];
  uploadedFiles: UploadedFile[];
}

export async function loadLibrary(): Promise<LibraryState> {
  const stored = await localforage.getItem<LibraryState>(LIBRARY_KEY);
  return stored ?? { courses: [], uploadedFiles: [] };
}

export async function saveLibrary(state: LibraryState): Promise<void> {
  await localforage.setItem(LIBRARY_KEY, state);
}

export async function persistLibraryCourse(course: Course, file: UploadedFile): Promise<LibraryState> {
  const lib = await loadLibrary();
  const fileIdx = lib.uploadedFiles.findIndex((f) => f.id === file.id);
  if (fileIdx >= 0) lib.uploadedFiles[fileIdx] = file;
  else lib.uploadedFiles.push(file);

  file.courseId = course.id;
  const courseIdx = lib.courses.findIndex((c) => c.id === course.id);
  if (courseIdx >= 0) lib.courses[courseIdx] = course;
  else lib.courses.push(course);

  await saveLibrary(lib);
  return lib;
}

export function gatherAnalyzedText(files: UploadedFile[], courseId?: string): string {
  const filtered = courseId
    ? files.filter((f) => f.courseId === courseId && f.extractedText.length >= 80)
    : files.filter((f) => f.extractedText.length >= 80);
  return filtered.map((f) => f.extractedText).join('\n\n---\n\n');
}
