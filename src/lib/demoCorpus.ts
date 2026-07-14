import { chunkDocument, type CorpusDoc } from './rag';

/** Built-in demo texts — always available for offline RAG even if localforage is empty. */
export const DEMO_MICROECONOMICS_TEXT = `
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

export const DEMO_DATA_ANALYSIS_TEXT = `
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

export const DEMO_RAG_SOURCES = [
  {
    fileId: 'demo-file-cournot',
    fileName: 'Demo: Microeconomics.pdf',
    text: DEMO_MICROECONOMICS_TEXT,
    courseId: 'demo-course-micro',
  },
  {
    fileId: 'demo-file-data-analysis',
    fileName: 'Introduction to Data Analysis.pdf',
    text: DEMO_DATA_ANALYSIS_TEXT,
    courseId: 'demo-course-data',
  },
] as const;

export function buildDemoCorpusDocs(docIds?: string[]): CorpusDoc[] {
  const allowed =
    docIds && docIds.length > 0 ? new Set(docIds) : null;

  const corpus: CorpusDoc[] = [];
  for (const source of DEMO_RAG_SOURCES) {
    if (allowed && !allowed.has(source.fileId)) continue;
    const chunks = chunkDocument(source.text);
    chunks.forEach((text, chunkIndex) => {
      corpus.push({
        id: `${source.fileId}_chunk_${chunkIndex}`,
        docId: source.fileId,
        docTitle: source.fileName,
        text,
        chunkIndex,
      });
    });
  }
  return corpus;
}
