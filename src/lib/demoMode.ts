import { processTextToCourse } from './uploadPipeline';
import { persistLibraryCourse, loadLibrary } from './libraryStorage';
import { indexDocumentForRag, getEmbeddingsByDocId } from './vectorStore';
import { useStore } from '../store/useStore';
import {
  seedDemoTasks,
  seedDemoActivities,
  setDemoModeFlag,
  isDemoModeActive,
} from './demoStorage';
import {
  DEMO_DATA_ANALYSIS_TEXT,
  DEMO_MICROECONOMICS_TEXT,
  DEMO_RAG_SOURCES,
} from './demoCorpus';

async function ensureDemoCourse(
  courseId: string,
  fileId: string,
  fileName: string,
  text: string,
) {
  const lib = await loadLibrary();
  let course = lib.courses.find((c) => c.id === courseId);
  let file = lib.uploadedFiles.find((f) => f.id === fileId);

  const needsPersist =
    !course ||
    !file ||
    !file.extractedText?.trim() ||
    file.extractedText.length < 80;

  if (needsPersist) {
    const built = processTextToCourse(text, fileName, fileId);
    course = built.course;
    course.id = courseId;
    file = built.file;
    file.id = fileId;
    file.courseId = courseId;
    file.name = fileName;
    file.extractedText = text;
    await persistLibraryCourse(course, file);
  }

  await indexDocumentForRag(file!.id, file!.name, file!.extractedText);
  return course!;
}

export async function seedDemoCourse() {
  return ensureDemoCourse(
    'demo-course-micro',
    'demo-file-cournot',
    'Demo: Microeconomics.pdf',
    DEMO_MICROECONOMICS_TEXT,
  );
}

export async function seedDemoDataAnalysisCourse() {
  return ensureDemoCourse(
    'demo-course-data',
    'demo-file-data-analysis',
    'Introduction to Data Analysis.pdf',
    DEMO_DATA_ANALYSIS_TEXT,
  );
}

export function seedDemoStoreStats() {
  const store = useStore.getState();
  if (store.xp > 0 && store.streak > 0) return;

  const now = new Date();
  const history = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    return {
      id: `demo-session-${i}`,
      date: d.toISOString(),
      duration: 25 + i * 10,
      type: 'focus' as const,
    };
  });

  useStore.setState({
    xp: 340,
    streak: 5,
    pomodoroSessions: 12,
    studySessionsHistory: history,
    customGoals: [
      { id: 'demo-goal-1', text: 'Finish Microeconomics module 1', type: 'weekly', completed: false },
      { id: 'demo-goal-2', text: 'Review elasticity flashcards', type: 'daily', completed: true },
    ],
  });
}

export async function seedDemoSandbox() {
  setDemoModeFlag(true);
  await seedDemoCourse();
  await seedDemoDataAnalysisCourse();
  await seedDemoTasks();
  await seedDemoActivities();
  seedDemoStoreStats();
}

/** Repair demo library + RAG index on every demo session (idempotent). */
export async function ensureDemoSandboxReady(): Promise<void> {
  if (!isDemoModeActive()) return;
  setDemoModeFlag(true);
  await seedDemoCourse();
  await seedDemoDataAnalysisCourse();
  await seedDemoTasks();
  await seedDemoActivities();
  seedDemoStoreStats();
}

export function isDemoCourseId(id: string) {
  return id.startsWith('demo-');
}

export async function ensureDemoRagIndexed(): Promise<void> {
  await ensureDemoSandboxReady();
  for (const source of DEMO_RAG_SOURCES) {
    const existing = await getEmbeddingsByDocId(source.fileId);
    if (existing.length === 0) {
      await indexDocumentForRag(source.fileId, source.fileName, source.text);
    }
  }
}

export { isDemoModeActive, setDemoModeFlag, DEMO_RAG_SOURCES };
