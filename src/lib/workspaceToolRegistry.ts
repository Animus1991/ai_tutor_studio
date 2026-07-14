import type { WorkspaceToolId } from './workspaceNoteContent';
import {
  Brain, GitCompare, Timer, MessageSquare, BookOpen, Calculator,
  Network, FlaskConical, PenTool, GraduationCap, FileText, LayoutDashboard, HelpCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface WorkspaceToolDef {
  id: WorkspaceToolId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  shortcut: string;
}

export const WORKSPACE_TOOLS: WorkspaceToolDef[] = [
  { id: 'concept-map', label: 'Concept Map', shortLabel: 'Map', icon: Network, description: 'Visualize concepts and prerequisites', shortcut: '1' },
  { id: 'sandbox', label: 'Sandbox', shortLabel: 'Sandbox', icon: FlaskConical, description: 'Interactive parameter exploration', shortcut: '2' },
  { id: 'leitner', label: 'Leitner / FSRS', shortLabel: 'Cards', icon: GraduationCap, description: 'Spaced repetition flashcards', shortcut: '3' },
  { id: 'compare', label: 'Compare', shortLabel: 'Compare', icon: GitCompare, description: 'Side-by-side concept comparisons', shortcut: '4' },
  { id: 'whiteboard', label: 'Whiteboard', shortLabel: 'Board', icon: PenTool, description: 'Draw and annotate with formulas sidebar', shortcut: '5' },
  { id: 'feynman', label: 'Feynman', shortLabel: 'Feynman', icon: Brain, description: 'Explain in your own words', shortcut: '6' },
  { id: 'timer', label: 'Timer', shortLabel: 'Timer', icon: Timer, description: 'Pomodoro study session timer', shortcut: '7' },
  { id: 'debate', label: 'Debate', shortLabel: 'Debate', icon: MessageSquare, description: 'Argument tree from notes', shortcut: '8' },
  { id: 'reader', label: 'Reader', shortLabel: 'Reader', icon: BookOpen, description: 'Structured source reader with excerpts', shortcut: '9' },
  { id: 'scratchpad', label: 'Scratchpad', shortLabel: 'Math', icon: Calculator, description: 'Formula solver from notes', shortcut: '0' },
  { id: 'source', label: 'Source', shortLabel: 'Source', icon: FileText, description: 'Annotations and source intelligence', shortcut: 'S' },
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Progress', icon: LayoutDashboard, description: 'Mastery, quiz accuracy, and engagement tracking', shortcut: 'D' },
  { id: 'quiz', label: 'Quiz', shortLabel: 'Quiz', icon: HelpCircle, description: 'Adaptive quiz with IRT scoring', shortcut: 'Q' },
];

export const WORKSPACE_TOOL_GROUPS = [
  { label: 'Visualize', tools: ['concept-map', 'compare', 'whiteboard'] as WorkspaceToolId[] },
  { label: 'Practice', tools: ['leitner', 'feynman', 'debate', 'scratchpad', 'quiz'] as WorkspaceToolId[] },
  { label: 'Study', tools: ['reader', 'sandbox', 'timer', 'source'] as WorkspaceToolId[] },
  { label: 'Progress', tools: ['dashboard'] as WorkspaceToolId[] },
];
