import { processTextToCourse } from './uploadPipeline';
import { persistLibraryCourse, loadLibrary } from './libraryStorage';
import { chunkText, generateEmbedding, saveEmbedding, deleteEmbeddingsForDoc } from './vectorStore';
import { useStore } from '../store/useStore';
import {
  seedDemoTasks,
  seedDemoActivities,
  setDemoModeFlag,
  isDemoModeActive,
} from './demoStorage';

const DEMO_TEXT = `
# Introduction to Microeconomics

Market equilibrium occurs where supply equals demand. The price mechanism allocates scarce resources.

## Cournot vs Bertrand Competition

Cournot competition vs Bertrand competition: firms choose quantities versus prices respectively.
In Cournot models, firms simultaneously choose output levels. In Bertrand models, firms compete on price.

## Elasticity

Price elasticity of demand measures responsiveness of quantity demanded to price changes.
Elastic demand means |E| > 1. Inelastic demand means |E| < 1.

Definition: Consumer surplus is the area between the demand curve and the market price.
Definition: Producer surplus is the area between the supply curve and the market price.

The marginal cost equation is MC = 2q + 5 for a representative firm.
Total revenue TR = p * q where p is market price and q is quantity sold.
`.trim();

const DEMO_DATA_ANALYSIS_TEXT = `
# Introduction to Data Analysis

Data analysis is the process of inspecting, cleansing, transforming, and modeling data to discover useful information.

## Descriptive Statistics

Mean, median, and mode summarize central tendency. Standard deviation measures spread.
Definition: A histogram visualizes the frequency distribution of numeric data.

## Inferential Statistics

Hypothesis testing evaluates claims about population parameters using sample data.
The p-value indicates the probability of observing results at least as extreme under the null hypothesis.
Correlation does not imply causation — confounding variables must be controlled.

## Regression

Linear regression models the relationship Y = beta0 + beta1 * X + epsilon.
R-squared measures the proportion of variance explained by the model.
`.trim();

export async function seedDemoCourse() {
  const fileId = 'demo-file-cournot';
  const lib = await loadLibrary();
  const existing = lib.courses.find((c) => c.id === 'demo-course-micro');
  if (existing) return existing;

  const { course, file } = processTextToCourse(DEMO_TEXT, 'Demo: Microeconomics.pdf', fileId);
  course.id = 'demo-course-micro';
  file.id = fileId;
  file.courseId = course.id;
  file.name = 'Demo: Microeconomics.pdf';
  await persistLibraryCourse(course, file);
  await indexDemoFileForRag(file.id, file.name, file.extractedText);
  return course;
}

export async function seedDemoDataAnalysisCourse() {
  const fileId = 'demo-file-data-analysis';
  const lib = await loadLibrary();
  const existing = lib.courses.find((c) => c.id === 'demo-course-data');
  if (existing) return existing;

  const { course, file } = processTextToCourse(DEMO_DATA_ANALYSIS_TEXT, 'Introduction to Data Analysis.pdf', fileId);
  course.id = 'demo-course-data';
  file.id = fileId;
  file.courseId = course.id;
  file.name = 'Introduction to Data Analysis.pdf';
  await persistLibraryCourse(course, file);
  await indexDemoFileForRag(file.id, file.name, file.extractedText);
  return course;
}

async function indexDemoFileForRag(fileId: string, fileName: string, text: string) {
  await deleteEmbeddingsForDoc(fileId);
  const chunks = chunkText(text);
  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await generateEmbedding(chunks[i]);
      await saveEmbedding({
        id: `${fileId}_chunk_${i}`,
        docId: fileId,
        docTitle: fileName,
        text: chunks[i],
        embedding,
      });
    } catch {
      /* embedding optional without API key */
    }
  }
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

export function isDemoCourseId(id: string) {
  return id.startsWith('demo-');
}

export { isDemoModeActive, setDemoModeFlag };
