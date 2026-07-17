/**
 * Shared workspace tool registry — state schema, persistence key, pedagogy intent, a11y.
 */
import type { WorkspaceToolId } from './workspaceNoteContent';
import {
  Brain,
  GitCompare,
  Timer,
  MessageSquare,
  BookOpen,
  Calculator,
  Network,
  FlaskConical,
  PenTool,
  GraduationCap,
  FileText,
  LayoutDashboard,
  HelpCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EvidencePrincipleId } from './evidencePrinciples';

export type PedagogyIntent =
  | 'visualize'
  | 'retrieve'
  | 'explain'
  | 'practice'
  | 'monitor'
  | 'focus'
  | 'create';

export type WorkspaceToolA11y = {
  ariaLabel: string;
  ariaLabelEl: string;
  liveRegion?: boolean;
  reducedMotionSafe: boolean;
};

export type WorkspaceToolDef = {
  id: WorkspaceToolId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  shortcut: string;
  /** localStorage / session key suffix */
  persistenceKey: string;
  /** Lightweight JSON-schema-ish state contract */
  stateSchema: {
    type: 'object';
    required?: string[];
    properties: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>;
  };
  pedagogyIntent: PedagogyIntent;
  evidencePrinciples: EvidencePrincipleId[];
  a11y: WorkspaceToolA11y;
};

function tool(
  partial: Omit<WorkspaceToolDef, 'persistenceKey' | 'a11y'> & {
    a11y?: Partial<WorkspaceToolA11y>;
  },
): WorkspaceToolDef {
  return {
    ...partial,
    persistenceKey: `tool:${partial.id}`,
    a11y: {
      ariaLabel: partial.a11y?.ariaLabel ?? partial.label,
      ariaLabelEl: partial.a11y?.ariaLabelEl ?? partial.label,
      liveRegion: partial.a11y?.liveRegion ?? false,
      reducedMotionSafe: partial.a11y?.reducedMotionSafe ?? true,
    },
  };
}

export const WORKSPACE_TOOLS: WorkspaceToolDef[] = [
  tool({
    id: 'concept-map',
    label: 'Concept Map',
    shortLabel: 'Map',
    icon: Network,
    description: 'Visualize concepts and prerequisites',
    shortcut: '1',
    stateSchema: { type: 'object', properties: { nodes: 'array', edges: 'array' } },
    pedagogyIntent: 'visualize',
    evidencePrinciples: ['dual_coding', 'cognitive_load'],
  }),
  tool({
    id: 'sandbox',
    label: 'Sandbox',
    shortLabel: 'Sandbox',
    icon: FlaskConical,
    description: 'Interactive parameter exploration (no egress)',
    shortcut: '2',
    stateSchema: { type: 'object', properties: { params: 'object', lastRun: 'string' } },
    pedagogyIntent: 'practice',
    evidencePrinciples: ['desirable_difficulties', 'cognitive_load'],
  }),
  tool({
    id: 'leitner',
    label: 'Leitner / FSRS',
    shortLabel: 'Cards',
    icon: GraduationCap,
    description: 'Spaced repetition flashcards',
    shortcut: '3',
    stateSchema: { type: 'object', properties: { deckId: 'string', dueCount: 'number' } },
    pedagogyIntent: 'retrieve',
    evidencePrinciples: ['spacing', 'retrieval'],
  }),
  tool({
    id: 'compare',
    label: 'Compare',
    shortLabel: 'Compare',
    icon: GitCompare,
    description: 'Side-by-side concept comparisons',
    shortcut: '4',
    stateSchema: { type: 'object', properties: { left: 'string', right: 'string' } },
    pedagogyIntent: 'visualize',
    evidencePrinciples: ['interleaving', 'cognitive_load'],
  }),
  tool({
    id: 'whiteboard',
    label: 'Whiteboard',
    shortLabel: 'Board',
    icon: PenTool,
    description: 'Draw and annotate with formulas sidebar',
    shortcut: '5',
    stateSchema: { type: 'object', properties: { strokes: 'array', nodes: 'array' } },
    pedagogyIntent: 'create',
    evidencePrinciples: ['dual_coding'],
  }),
  tool({
    id: 'feynman',
    label: 'Feynman',
    shortLabel: 'Feynman',
    icon: Brain,
    description: 'Explain in your own words',
    shortcut: '6',
    stateSchema: { type: 'object', properties: { draft: 'string', gaps: 'array' } },
    pedagogyIntent: 'explain',
    evidencePrinciples: ['feynman', 'retrieval'],
  }),
  tool({
    id: 'timer',
    label: 'Timer',
    shortLabel: 'Timer',
    icon: Timer,
    description: 'Pomodoro study session timer',
    shortcut: '7',
    stateSchema: {
      type: 'object',
      properties: { phase: 'string', elapsedSec: 'number', running: 'boolean' },
    },
    pedagogyIntent: 'focus',
    evidencePrinciples: ['self_determination', 'spacing'],
    a11y: { ariaLabel: 'Study timer', ariaLabelEl: 'Χρονόμετρο μελέτης', liveRegion: true, reducedMotionSafe: true },
  }),
  tool({
    id: 'debate',
    label: 'Debate',
    shortLabel: 'Debate',
    icon: MessageSquare,
    description: 'Argument tree from notes',
    shortcut: '8',
    stateSchema: { type: 'object', properties: { claims: 'array', score: 'number' } },
    pedagogyIntent: 'explain',
    evidencePrinciples: ['retrieval', 'scaffolding'],
  }),
  tool({
    id: 'reader',
    label: 'Reader',
    shortLabel: 'Reader',
    icon: BookOpen,
    description: 'Structured source reader with excerpts',
    shortcut: '9',
    stateSchema: {
      type: 'object',
      properties: { scrollPct: 'number', annotations: 'array' },
    },
    pedagogyIntent: 'retrieve',
    evidencePrinciples: ['cognitive_load', 'dual_coding'],
  }),
  tool({
    id: 'scratchpad',
    label: 'Scratchpad',
    shortLabel: 'Math',
    icon: Calculator,
    description: 'Formula solver from notes (sandboxed)',
    shortcut: '0',
    stateSchema: { type: 'object', properties: { input: 'string', output: 'string' } },
    pedagogyIntent: 'practice',
    evidencePrinciples: ['desirable_difficulties'],
  }),
  tool({
    id: 'source',
    label: 'Source',
    shortLabel: 'Source',
    icon: FileText,
    description: 'Annotations and source intelligence',
    shortcut: 'S',
    stateSchema: { type: 'object', properties: { highlights: 'array' } },
    pedagogyIntent: 'retrieve',
    evidencePrinciples: ['retrieval', 'cognitive_load'],
  }),
  tool({
    id: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Progress',
    icon: LayoutDashboard,
    description: 'Mastery, quiz accuracy, and engagement tracking',
    shortcut: 'D',
    stateSchema: { type: 'object', properties: { filter: 'string' } },
    pedagogyIntent: 'monitor',
    evidencePrinciples: ['irt_calibration', 'self_determination'],
  }),
  tool({
    id: 'quiz',
    label: 'Quiz',
    shortLabel: 'Quiz',
    icon: HelpCircle,
    description: 'Adaptive quiz with IRT scoring',
    shortcut: 'Q',
    stateSchema: {
      type: 'object',
      properties: { ability: 'number', index: 'number', responses: 'array' },
    },
    pedagogyIntent: 'retrieve',
    evidencePrinciples: ['retrieval', 'irt_calibration', 'spacing'],
    a11y: {
      ariaLabel: 'Adaptive quiz',
      ariaLabelEl: 'Προσαρμοστικό κουίζ',
      liveRegion: true,
      reducedMotionSafe: true,
    },
  }),
];

export const WORKSPACE_TOOL_GROUPS = [
  { label: 'Visualize', tools: ['concept-map', 'compare', 'whiteboard'] as WorkspaceToolId[] },
  { label: 'Practice', tools: ['leitner', 'feynman', 'debate', 'scratchpad', 'quiz'] as WorkspaceToolId[] },
  { label: 'Study', tools: ['reader', 'sandbox', 'timer', 'source'] as WorkspaceToolId[] },
  { label: 'Progress', tools: ['dashboard'] as WorkspaceToolId[] },
];

export function getWorkspaceTool(id: WorkspaceToolId): WorkspaceToolDef | undefined {
  return WORKSPACE_TOOLS.find((t) => t.id === id);
}

export function persistenceKeyForTool(progressKey: string, toolId: WorkspaceToolId): string {
  const def = getWorkspaceTool(toolId);
  return `synapse:workspace:${progressKey}:${def?.persistenceKey ?? `tool:${toolId}`}`;
}
