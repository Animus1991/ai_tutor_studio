import type { CourseOutline, CourseSourceQuality } from './courseTypes';
import { detectDocumentSections } from './textSegmentation';
import { rankKeyphrases } from './contentAnalysis';

export function analyzeCourseSourceQuality(text: string, outline: CourseOutline): CourseSourceQuality {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sections = detectDocumentSections(text);
  const keyphrases = rankKeyphrases(text, 20);
  const glossaryCount = outline.glossary.length;
  const topicCount = outline.topics.length;
  const definitionSignals = (text.match(/\b(is|are|means|defined as|ορισμός)\b/gi) ?? []).length;
  const formulaSignals = (text.match(/[=+\-*/^]|\\frac|\\sum/g) ?? []).length;

  let score = 0;
  score += Math.min(25, wordCount / 40);
  score += Math.min(15, sections.length * 3);
  score += Math.min(15, glossaryCount * 2);
  score += Math.min(15, keyphrases.length);
  score += Math.min(10, definitionSignals * 2);
  score += Math.min(10, formulaSignals * 3);
  score += Math.min(10, topicCount * 2);
  score = Math.round(Math.min(100, score));

  const band: CourseSourceQuality['band'] =
    score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

  const warnings: string[] = [];
  const nextActions: string[] = [];

  if (wordCount < 200) warnings.push('Source text is very short — add more material for richer courses.');
  if (glossaryCount < 3) warnings.push('Few glossary terms detected — definitions may be sparse.');
  if (sections.length < 2) warnings.push('Document lacks clear section structure.');
  if (topicCount > Math.max(3, Math.floor(wordCount / 500))) {
    warnings.push('Topic count may exceed source density — outline will be compacted.');
  }

  if (band === 'weak') nextActions.push('Upload additional lecture notes or textbooks.');
  if (glossaryCount < 5) nextActions.push('Add material with explicit definitions.');
  nextActions.push('Open Study Workspace to review grounded tools.');

  const recommendedTopicCount = Math.max(2, Math.min(12, Math.floor(wordCount / 400) + 1));
  const needsMoreMaterial = wordCount < 80 || score < 40;

  return {
    score,
    band,
    needsMoreMaterial,
    warnings,
    nextActions,
    recommendedTopicCount,
    detectedTopicCount: topicCount,
    finalTopicCount: topicCount,
    outlineAdjusted: false,
  };
}

export function adaptOutlineToSourceQuality(
  outline: CourseOutline,
  quality: CourseSourceQuality,
): CourseOutline {
  if (outline.topics.length <= quality.recommendedTopicCount) {
    return outline;
  }

  const merged: typeof outline.topics = [];
  const chunkSize = Math.ceil(outline.topics.length / quality.recommendedTopicCount);

  for (let i = 0; i < outline.topics.length; i += chunkSize) {
    const group = outline.topics.slice(i, i + chunkSize);
    merged.push({
      id: group[0].id,
      title: group[0].title,
      description: group.map((t) => t.description).join(' ').slice(0, 400),
      objectives: [...new Set(group.flatMap((t) => t.objectives))].slice(0, 4),
      durationMinutes: group.reduce((s, t) => s + t.durationMinutes, 0),
    });
  }

  return {
    ...outline,
    topics: merged,
  };
}
