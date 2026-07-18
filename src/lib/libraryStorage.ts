import localforage from 'localforage';
import type { Course, UploadedFile } from './courseTypes';

const LIBRARY_KEY = 'memora:library-v1';

export interface LibraryState {
  courses: Course[];
  uploadedFiles: UploadedFile[];
  /** Optimistic concurrency token — increments on every persist. */
  libraryVersion: number;
}

export class LibraryConflictError extends Error {
  readonly name = 'LibraryConflictError';
  constructor(
    public readonly currentVersion: number,
    public readonly expectedVersion: number,
  ) {
    super(
      `Library version conflict (expected ${expectedVersion}, current ${currentVersion})`,
    );
  }
}

function normalizeState(stored: LibraryState | null): LibraryState {
  if (!stored) return { courses: [], uploadedFiles: [], libraryVersion: 0 };
  return {
    courses: Array.isArray(stored.courses) ? stored.courses : [],
    uploadedFiles: Array.isArray(stored.uploadedFiles) ? stored.uploadedFiles : [],
    libraryVersion: typeof stored.libraryVersion === 'number' ? stored.libraryVersion : 0,
  };
}

export async function loadLibrary(): Promise<LibraryState> {
  const stored = await localforage.getItem<LibraryState>(LIBRARY_KEY);
  return normalizeState(stored);
}

/**
 * Persist library. When `expectedVersion` is set, fails with LibraryConflictError
 * if the stored version moved ahead (optimistic concurrency / ETag-style).
 */
export async function saveLibrary(
  state: LibraryState,
  expectedVersion?: number,
): Promise<LibraryState> {
  const current = await loadLibrary();
  if (expectedVersion !== undefined && current.libraryVersion !== expectedVersion) {
    throw new LibraryConflictError(current.libraryVersion, expectedVersion);
  }
  const next: LibraryState = {
    courses: state.courses,
    uploadedFiles: state.uploadedFiles,
    libraryVersion: current.libraryVersion + 1,
  };
  await localforage.setItem(LIBRARY_KEY, next);
  return next;
}

export async function persistLibraryCourse(
  course: Course,
  file: UploadedFile,
  expectedVersion?: number,
): Promise<LibraryState> {
  const lib = await loadLibrary();
  if (expectedVersion !== undefined && lib.libraryVersion !== expectedVersion) {
    throw new LibraryConflictError(lib.libraryVersion, expectedVersion);
  }
  const fileIdx = lib.uploadedFiles.findIndex((f) => f.id === file.id);
  if (fileIdx >= 0) lib.uploadedFiles[fileIdx] = file;
  else lib.uploadedFiles.push(file);

  file.courseId = course.id;
  const courseIdx = lib.courses.findIndex((c) => c.id === course.id);
  if (courseIdx >= 0) lib.courses[courseIdx] = course;
  else lib.courses.push(course);

  return saveLibrary(lib, lib.libraryVersion);
}

/** Soft-delete course + mark file tombstones for re-index consumers. */
export async function tombstoneLibraryCourse(courseId: string): Promise<LibraryState> {
  const lib = await loadLibrary();
  const courses = lib.courses.filter((c) => c.id !== courseId);
  const uploadedFiles = lib.uploadedFiles.map((f) =>
    f.courseId === courseId
      ? ({ ...f, courseId: undefined, tombstonedAt: new Date().toISOString() } as UploadedFile & {
          tombstonedAt?: string;
        })
      : f,
  );
  return saveLibrary({ ...lib, courses, uploadedFiles }, lib.libraryVersion);
}

export function gatherAnalyzedText(files: UploadedFile[], courseId?: string): string {
  const filtered = courseId
    ? files.filter((f) => f.courseId === courseId && f.extractedText.length >= 80)
    : files.filter((f) => f.extractedText.length >= 80);
  return filtered.map((f) => f.extractedText).join('\n\n---\n\n');
}
