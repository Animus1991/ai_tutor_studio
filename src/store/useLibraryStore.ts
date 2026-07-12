import { create } from 'zustand';
import { extractFileContent, mergeOutlineIntoCourse, processTextToCourse } from '../lib/uploadPipeline';
import { loadLibrary, persistLibraryCourse, saveLibrary, type LibraryState } from '../lib/libraryStorage';
import { chunkText, generateEmbedding, saveEmbedding, deleteEmbeddingsForDoc } from '../lib/vectorStore';
import type { Course, UploadedFile } from '../lib/courseTypes';
import { logActivity } from '../lib/activity';
import { batchIngestYoutube } from '../lib/api';

interface LibraryStore extends LibraryState {
  isProcessing: boolean;
  lastUploadQuality: { score: number; band: string; warnings: string[] } | null;
  hydrate: () => Promise<void>;
  processUpload: (file: File, extendCourseId?: string) => Promise<Course>;
  processYoutubeBatch: (urls: string[], extendCourseId?: string) => Promise<Course>;
  getCourse: (id: string) => Course | undefined;
  getCourseFiles: (courseId: string) => UploadedFile[];
}

async function indexFileForRag(file: UploadedFile) {
  await deleteEmbeddingsForDoc(file.id);
  const chunks = chunkText(file.extractedText);
  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await generateEmbedding(chunks[i]);
      await saveEmbedding({
        id: `${file.id}_chunk_${i}`,
        docId: file.id,
        docTitle: file.name,
        text: chunks[i],
        embedding,
      });
    } catch {
      /* embedding optional */
    }
  }
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  courses: [],
  uploadedFiles: [],
  isProcessing: false,
  lastUploadQuality: null,

  hydrate: async () => {
    const lib = await loadLibrary();
    set({ courses: lib.courses, uploadedFiles: lib.uploadedFiles });
  },

  getCourse: (id) => get().courses.find((c) => c.id === id),
  getCourseFiles: (courseId) => get().uploadedFiles.filter((f) => f.courseId === courseId),

  processUpload: async (file, extendCourseId) => {
    set({ isProcessing: true });
    try {
      const text = await extractFileContent(file);
      if (text.length < 80) {
        throw new Error('Extracted text too short (minimum 80 characters). Try a longer document.');
      }

      const fileId = crypto.randomUUID();
      let { course, file: uploadedFile, quality } = processTextToCourse(text, file.name, fileId);

      if (extendCourseId) {
        const existing = get().courses.find((c) => c.id === extendCourseId);
        if (existing) {
          course = mergeOutlineIntoCourse(existing, {
            title: course.title,
            topics: course.topics,
            glossary: course.glossary,
            prerequisites: course.prerequisites,
          });
          course.uploadedFileIds = [...new Set([...course.uploadedFileIds, fileId])];
          uploadedFile.courseId = course.id;
        }
      }

      uploadedFile.courseId = course.id;
      const lib = await persistLibraryCourse(course, uploadedFile);
      set({
        courses: lib.courses,
        uploadedFiles: lib.uploadedFiles,
        lastUploadQuality: { score: quality.score, band: quality.band, warnings: quality.warnings },
      });

      indexFileForRag(uploadedFile).catch(console.error);
      logActivity(`Uploaded: ${file.name}`, 'upload');
      return course;
    } finally {
      set({ isProcessing: false });
    }
  },

  processYoutubeBatch: async (urls, extendCourseId) => {
    set({ isProcessing: true });
    try {
      const { results } = await batchIngestYoutube(urls);
      const ok = results.filter((r) => r.text && r.text.length >= 80);
      if (ok.length === 0) {
        const firstErr = results.find((r) => r.error)?.error;
        throw new Error(firstErr ?? 'No transcripts extracted from the provided URLs');
      }

      const combined = ok
        .map((r, i) => `## Lecture ${i + 1}: ${r.title ?? r.url}\n\n${r.text}`)
        .join('\n\n---\n\n');

      const batchName = `YouTube Batch (${ok.length} lecture${ok.length > 1 ? 's' : ''})`;
      const fileId = crypto.randomUUID();
      let { course, file: uploadedFile, quality } = processTextToCourse(combined, batchName, fileId);

      if (extendCourseId) {
        const existing = get().courses.find((c) => c.id === extendCourseId);
        if (existing) {
          course = mergeOutlineIntoCourse(existing, {
            title: course.title,
            topics: course.topics,
            glossary: course.glossary,
            prerequisites: course.prerequisites,
          });
          course.uploadedFileIds = [...new Set([...course.uploadedFileIds, fileId])];
          uploadedFile.courseId = course.id;
        }
      }

      uploadedFile.courseId = course.id;
      const lib = await persistLibraryCourse(course, uploadedFile);
      set({
        courses: lib.courses,
        uploadedFiles: lib.uploadedFiles,
        lastUploadQuality: { score: quality.score, band: quality.band, warnings: quality.warnings },
      });

      indexFileForRag(uploadedFile).catch(console.error);
      logActivity(`YouTube batch: ${ok.length} lectures`, 'upload');
      return course;
    } finally {
      set({ isProcessing: false });
    }
  },
}));

// Hydrate on module load
useLibraryStore.getState().hydrate();
