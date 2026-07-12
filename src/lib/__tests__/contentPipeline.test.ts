import { describe, it, expect } from 'vitest';
import { analyzeContentToOutline } from '../contentAnalysis';
import { analyzeCourseSourceQuality, adaptOutlineToSourceQuality } from '../courseSourceQuality';
import { processTextToCourse, normalizeDocumentText } from '../uploadPipeline';
import { buildWorkspaceNoteBundle } from '../workspaceNoteContent';

const SAMPLE = `
# Introduction to Photosynthesis

Photosynthesis is the process by which green plants convert light energy into chemical energy.
The equation for photosynthesis is: 6CO2 + 6H2O → C6H12O6 + 6O2

## Light Reactions
Chlorophyll absorbs light in the thymylakoid membranes. ATP and NADPH are produced.

## Calvin Cycle
Carbon fixation occurs in the stroma. RuBisCO catalyzes the first step.

Mitochondria vs Chloroplast: mitochondria produce ATP through respiration while chloroplasts produce glucose through photosynthesis.
`.repeat(2);

describe('Content Pipeline', () => {
  it('normalizes document text', () => {
    const normalized = normalizeDocumentText('Hello\r\n\r\nWorld\fPage2');
    expect(normalized).toContain('page break');
    expect(normalized).not.toContain('\r');
  });

  it('generates offline course outline', () => {
    const outline = analyzeContentToOutline(SAMPLE, 'Biology.pdf');
    expect(outline.topics.length).toBeGreaterThan(0);
    expect(outline.title).toBe('Biology');
  });

  it('scores source quality', () => {
    const outline = analyzeContentToOutline(SAMPLE, 'Bio');
    const quality = analyzeCourseSourceQuality(SAMPLE, outline);
    expect(quality.score).toBeGreaterThan(0);
    expect(['weak', 'moderate', 'strong']).toContain(quality.band);
  });

  it('adapts outline when too many topics', () => {
    const outline = analyzeContentToOutline(SAMPLE, 'Bio');
    const quality = { ...analyzeCourseSourceQuality(SAMPLE, outline), recommendedTopicCount: 2 };
    const adapted = adaptOutlineToSourceQuality(outline, quality);
    expect(adapted.topics.length).toBeLessThanOrEqual(outline.topics.length);
  });

  it('processes text to full course', () => {
    const { course, file, quality } = processTextToCourse(SAMPLE, 'Bio.pdf', 'file-1');
    expect(course.id).toBeTruthy();
    expect(file.extractedText.length).toBeGreaterThan(80);
    expect(quality.score).toBeGreaterThan(0);
    expect(course.topics.length).toBeGreaterThan(0);
  });

  it('builds workspace bundle with source', () => {
    const { course, file } = processTextToCourse(SAMPLE, 'Bio.pdf', 'file-2');
    file.courseId = course.id;
    const bundle = buildWorkspaceNoteBundle([file], course);
    expect(bundle.hasSource).toBe(true);
    expect(bundle.flashcards.length).toBeGreaterThan(0);
    expect(bundle.sourceIntelligence.score).toBeGreaterThan(0);
  });
});
