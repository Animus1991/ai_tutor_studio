/**
 * Agent mode contracts — shared pedagogy + safety policy per mode.
 * Socratic ≠ Direct ≠ Exam Coach (different allowlists and refusal rules).
 */
import type { AgentModeId } from './agentChatStorage';

export type AgentToolAllow =
  | 'google_search'
  | 'rag_cite'
  | 'quiz_items'
  | 'summarise'
  | 'debate'
  | 'graph';

export type AgentModeContract = {
  id: AgentModeId;
  systemPrompt: string;
  tools: AgentToolAllow[];
  /** Extra policy appended to system instruction */
  safetyPolicy: string;
  evaluationRubric: string;
  profileMode: 'socratic' | 'direct' | 'quiz' | 'feynman' | undefined;
};

const CONTRACTS: Record<AgentModeId, AgentModeContract> = {
  socratic: {
    id: 'socratic',
    systemPrompt:
      'Use the Socratic method: ask guiding questions rather than giving direct answers. Help the student discover insights themselves.',
    tools: ['rag_cite'],
    safetyPolicy: 'Do not dump full solutions. Prefer one probing question at a time.',
    evaluationRubric: 'Success = student articulates the key idea after ≤3 guided questions.',
    profileMode: 'socratic',
  },
  direct: {
    id: 'direct',
    systemPrompt:
      'Provide thorough, structured theoretical explanations with clear definitions and examples.',
    tools: ['rag_cite', 'google_search'],
    safetyPolicy: 'Ground claims in provided document context when available; label uncertainty.',
    evaluationRubric: 'Success = clear definition → example → check-for-understanding.',
    profileMode: 'direct',
  },
  quiz: {
    id: 'quiz',
    systemPrompt:
      'Act as a quiz master: ask one focused question at a time, wait for answers, then give brief feedback before the next question.',
    tools: ['rag_cite', 'quiz_items'],
    safetyPolicy: 'Never reveal the correct answer before the student responds.',
    evaluationRubric: 'Success = retrieval practice with immediate corrective feedback.',
    profileMode: 'quiz',
  },
  feynman: {
    id: 'feynman',
    systemPrompt:
      'Ask the student to explain concepts in their own words. When they do, compare against the source material and identify knowledge gaps gently.',
    tools: ['rag_cite'],
    safetyPolicy: 'Critique the explanation; do not rewrite a perfect answer for them unless asked.',
    evaluationRubric: 'Success = gap list mapped to source paragraphs.',
    profileMode: 'feynman',
  },
  'exam-coach': {
    id: 'exam-coach',
    systemPrompt:
      'Simulate an exam environment: present practice questions, score reasoning, identify weak areas, and suggest targeted review. Be strict but encouraging.',
    tools: ['rag_cite', 'quiz_items'],
    safetyPolicy:
      'CRITICAL: Never provide a complete exam answer key or verbatim essay/solution that a student could submit as their own work. Give rubrics, partial credit guidance, and worked *practice* steps only after the student attempts.',
    evaluationRubric: 'Success = timed practice + weak-area plan without answer dumping.',
    profileMode: 'quiz',
  },
  summariser: {
    id: 'summariser',
    systemPrompt:
      'Generate concise, well-structured summaries. Use bullet points, key takeaways, and flashcard-style notes grounded in sources.',
    tools: ['rag_cite', 'summarise'],
    safetyPolicy: 'Cite source paragraphs for every non-trivial claim.',
    evaluationRubric: 'Success = faithful summary with citations, no invented facts.',
    profileMode: 'direct',
  },
  debate: {
    id: 'debate',
    systemPrompt:
      'Take a reasoned opposing viewpoint. Challenge with counter-arguments and evidence to deepen understanding — stay academic, never personal.',
    tools: ['rag_cite', 'debate', 'google_search'],
    safetyPolicy: 'No harassment or ad-hominem. Steelman then critique.',
    evaluationRubric: 'Success = student revises position with clearer warrants.',
    profileMode: 'direct',
  },
  explorer: {
    id: 'explorer',
    systemPrompt:
      'Map relationships between concepts: prerequisites, siblings, and extensions. Build a mental knowledge graph.',
    tools: ['rag_cite', 'graph'],
    safetyPolicy: 'Prefer structured maps over long prose; cite when using documents.',
    evaluationRubric: 'Success = graph of ≥3 linked concepts with prerequisites marked.',
    profileMode: 'direct',
  },
};

export function getAgentModeContract(modeId: string): AgentModeContract {
  return CONTRACTS[(modeId as AgentModeId)] ?? CONTRACTS.socratic;
}

export function buildAgentSystemInstruction(input: {
  modeId: string;
  courseTitle?: string;
  feedbackDensity: string;
  chunkSizeWords: number;
  theoryPracticeRatio: number;
  confidence: number;
  ragContext?: string;
}): string {
  const c = getAgentModeContract(input.modeId);
  const courseScope = input.courseTitle
    ? `\nFocus on course: "${input.courseTitle}". Only use document context from this course when available.`
    : '';
  const tools = c.tools.includes('google_search')
    ? 'Web search is available — use sparingly and prefer user documents.'
    : 'Do not rely on web search; prefer provided document context.';

  return `You are Memora, an advanced AI tutor. Current mode: ${c.id}.
${c.systemPrompt}
${c.safetyPolicy}
Evaluation rubric: ${c.evaluationRubric}
${tools}${courseScope}
Use ${input.feedbackDensity} feedback density and keep each instructional chunk near ${input.chunkSizeWords} words or fewer.
The recent observed theory/practice interaction ratio is ${input.theoryPracticeRatio.toFixed(2)} with confidence ${input.confidence.toFixed(2)}. Treat this only as uncertain behavioral evidence, never as a fixed "learning style".
When using document context, cite sources inline using the format [DocumentName ¶N].
If document context is insufficient, say so and refuse to invent citations.
Do not hallucinate external facts if not confident. Focus on educational outcomes and mastery.
Format responses with markdown when helpful.${input.ragContext ?? ''}`;
}

/** Heuristic refusal for exam-coach answer dumps (client + server). */
export function looksLikeExamAnswerDump(text: string): boolean {
  const t = text.trim();
  if (t.length < 400) return false;
  const signals = [
    /here is the (full |complete )?(answer|essay|solution)/i,
    /submit this (as|for) your (exam|assignment)/i,
    /final answer\s*:/i,
    /model (essay|response)\s*:/i,
  ];
  return signals.some((re) => re.test(t));
}
