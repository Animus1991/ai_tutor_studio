/**
 * Workspace Keyboard Shortcuts — comprehensive shortcut system for workspace navigation.
 */

import type { WorkspaceToolId } from './workspaceNoteContent';

export interface WorkspaceShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  descriptionEl: string;
  action: string;
}

export const WORKSPACE_SHORTCUTS: WorkspaceShortcut[] = [
  // Tool switching (1-9, 0, S)
  { key: '1', description: 'Concept Map', descriptionEl: 'Εννοιολογικός Χάρτης', action: 'tool:concept-map' },
  { key: '2', description: 'Sandbox', descriptionEl: 'Sandbox', action: 'tool:sandbox' },
  { key: '3', description: 'Leitner Cards', descriptionEl: 'Κάρτες Leitner', action: 'tool:leitner' },
  { key: '4', description: 'Compare', descriptionEl: 'Σύγκριση', action: 'tool:compare' },
  { key: '5', description: 'Whiteboard', descriptionEl: 'Πίνακας', action: 'tool:whiteboard' },
  { key: '6', description: 'Feynman', descriptionEl: 'Feynman', action: 'tool:feynman' },
  { key: '7', description: 'Timer', descriptionEl: 'Χρονόμετρο', action: 'tool:timer' },
  { key: '8', description: 'Debate', descriptionEl: 'Debate', action: 'tool:debate' },
  { key: '9', description: 'Reader', descriptionEl: 'Αναγνώστης', action: 'tool:reader' },
  { key: '0', description: 'Scratchpad', descriptionEl: 'Scratchpad', action: 'tool:scratchpad' },
  { key: 's', shift: true, description: 'Source', descriptionEl: 'Πηγή', action: 'tool:source' },
  { key: 'd', shift: true, description: 'Dashboard', descriptionEl: 'Πρόοδος', action: 'tool:dashboard' },
  { key: 'q', shift: true, description: 'Quiz', descriptionEl: 'Κουίζ', action: 'tool:quiz' },

  // Navigation
  { key: 'ArrowLeft', description: 'Previous step', descriptionEl: 'Προηγούμενο βήμα', action: 'step:prev' },
  { key: 'ArrowRight', description: 'Next step', descriptionEl: 'Επόμενο βήμα', action: 'step:next' },
  { key: 'Home', description: 'First step', descriptionEl: 'Πρώτο βήμα', action: 'step:first' },
  { key: 'End', description: 'Last step', descriptionEl: 'Τελευταίο βήμα', action: 'step:last' },

  // Actions
  { key: 'k', ctrl: true, description: 'Command palette', descriptionEl: 'Παλέτα εντολών', action: 'command-palette' },
  { key: 'f', ctrl: true, description: 'Focus search', descriptionEl: 'Αναζήτηση focus', action: 'focus-search' },
  { key: '?', shift: true, description: 'Keyboard help', descriptionEl: 'Βοήθεια πληκτρολογίου', action: 'keyboard-help' },
  { key: 'Escape', description: 'Close panel / exit', descriptionEl: 'Κλείσιμο / Έξοδος', action: 'escape' },
];

export function matchShortcut(e: KeyboardEvent): WorkspaceShortcut | null {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return null;

  for (const shortcut of WORKSPACE_SHORTCUTS) {
    const keyMatch = e.key === shortcut.key || e.key.toLowerCase() === shortcut.key.toLowerCase();
    const ctrlMatch = !shortcut.ctrl || (e.ctrlKey || e.metaKey);
    const shiftMatch = !shortcut.shift || e.shiftKey;
    const altMatch = !shortcut.alt || e.altKey;

    if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
      // Ensure exact modifier match for simple keys
      if (!shortcut.ctrl && (e.ctrlKey || e.metaKey)) continue;
      if (!shortcut.shift && e.shiftKey && shortcut.key.length === 1) continue;
      return shortcut;
    }
  }
  return null;
}

export function parseShortcutAction(action: string): { type: 'tool' | 'step' | 'action'; value: string } {
  if (action.startsWith('tool:')) return { type: 'tool', value: action.slice(5) as WorkspaceToolId };
  if (action.startsWith('step:')) return { type: 'step', value: action.slice(5) };
  return { type: 'action', value: action };
}
