import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import * as Y from 'yjs';
import { useLibraryStore } from '../../store/useLibraryStore';
import {
  buildWorkspaceNoteBundle,
  buildWorkspaceStepsFromNotes,
  type WorkspaceToolId,
} from '../../lib/workspaceNoteContent';
import { getNoteContentForLessonStep, buildQuizSetFromNotes } from '../../lib/groundedLesson';
import { useLanguage } from '../../lib/i18n';
import QuizStepPanel from './QuizStepPanel';
import FeynmanToolPanel from './FeynmanToolPanel';
import WorkspaceDock from './WorkspaceDock';
import WorkspaceEmptyState from './WorkspaceEmptyState';
import ConceptLensBar from './ConceptLensBar';
import LeitnerPanel from './LeitnerPanel';
import DebatePanel from './DebatePanel';
import ComparePanel from './ComparePanel';
import ReaderPanel from './ReaderPanel';
import ScratchpadPanel from './ScratchpadPanel';
import SimulatorPanel from './SimulatorPanel';
import StudyTimerPanel from './StudyTimerPanel';
import SourcePanel from './SourcePanel';
import DashboardPanel from './DashboardPanel';
import QuizPanel from './QuizPanel';
import { noteConceptActivity, loadConceptBus, serializeConceptBus } from '../../lib/workspaceConceptBus';
import { emitFocus } from '../../lib/workspaceFocus';
import { matchShortcut, parseShortcutAction } from '../../lib/workspaceKeyboardShortcuts';
import {
  saveWorkspaceSession,
  loadWorkspaceSession,
  saveConceptBus,
  loadConceptBus as loadBusFromStorage,
} from '../../lib/workspacePersistence';
import { logActivity } from '../../lib/activity';

// Heavy tools are code-split so the tldraw / @xyflow bundles load only when
// their respective tool tab is opened.
const Whiteboard = lazy(() => import('../Whiteboard'));
const ConceptMapGraph = lazy(() => import('./ConceptMapGraph'));

function ToolLoading() {
  return (
    <div className="flex items-center justify-center h-full gap-2 text-sm text-slate-500">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading tool…
    </div>
  );
}

function ToolPanel({
  toolId,
  bundle,
  ydoc,
  courseTitle,
  onSelectTool,
  onUpload,
  progressKey,
}: {
  toolId: WorkspaceToolId;
  bundle: ReturnType<typeof buildWorkspaceNoteBundle>;
  ydoc: Y.Doc;
  courseTitle?: string;
  onSelectTool: (id: WorkspaceToolId) => void;
  onUpload?: () => void;
  progressKey: string;
}) {
  // Per-tool empty state when no source data available for this specific tool
  const toolHasContent = (() => {
    switch (toolId) {
      case 'concept-map': return bundle.conceptMap.nodes.length > 0;
      case 'sandbox': return bundle.economicsSandbox || bundle.sandboxInsight.length > 0;
      case 'leitner': return bundle.flashcards.length > 0;
      case 'compare': return bundle.comparisons.length > 0;
      case 'whiteboard': return true; // always available
      case 'feynman': return bundle.hasSource;
      case 'timer': return true; // always available
      case 'debate': return bundle.debate.length > 0;
      case 'reader': return bundle.sections.length > 0 || bundle.readerExcerpt.length > 0;
      case 'scratchpad': return bundle.formulas.length > 0;
      case 'source': return bundle.hasSource;
      case 'dashboard': return true; // always available
      case 'quiz': return bundle.course != null && bundle.course.glossary.length > 0;
      default: return false;
    }
  })();

  if (!bundle.hasSource && toolId !== 'whiteboard' && toolId !== 'timer' && toolId !== 'dashboard') {
    return <WorkspaceEmptyState toolId={toolId} hasSource={false} onUpload={onUpload} />;
  }

  if (!toolHasContent && toolId !== 'whiteboard' && toolId !== 'timer') {
    return <WorkspaceEmptyState toolId={toolId} hasSource={bundle.hasSource} />;
  }

  switch (toolId) {
    case 'concept-map':
      return (
        <div className="h-full">
          <Suspense fallback={<ToolLoading />}>
            <ConceptMapGraph nodes={bundle.conceptMap.nodes} edges={bundle.conceptMap.edges} />
          </Suspense>
        </div>
      );
    case 'sandbox':
      return <SimulatorPanel sandboxInsight={bundle.sandboxInsight} economicsSandbox={bundle.economicsSandbox} formulas={bundle.formulas} />;
    case 'leitner':
      return <LeitnerPanel flashcards={bundle.flashcards} />;
    case 'compare':
      return <ComparePanel comparisons={bundle.comparisons} />;
    case 'whiteboard':
      return (
        <div className="h-full">
          <Suspense fallback={<ToolLoading />}>
            <Whiteboard ydoc={ydoc} />
          </Suspense>
        </div>
      );
    case 'feynman':
      return (
        <FeynmanToolPanel
          sourceText={bundle.sourceText}
          concept={bundle.concept}
          steps={bundle.feynman.steps}
          suggestedGaps={bundle.feynman.gaps}
          courseTitle={courseTitle}
        />
      );
    case 'timer':
      return <StudyTimerPanel />;
    case 'debate':
      return <DebatePanel debateNodes={bundle.debate} />;
    case 'reader':
      return <ReaderPanel sections={bundle.sections} readerExcerpt={bundle.readerExcerpt} sourceText={bundle.sourceText} progressKey={progressKey} />;
    case 'scratchpad':
      return <ScratchpadPanel formulas={bundle.formulas} />;
    case 'source':
      return <SourcePanel bundle={bundle} onSelectTool={onSelectTool} />;
    case 'dashboard':
      return <DashboardPanel bundle={bundle} progressKey={progressKey} courseId={progressKey} />;
    case 'quiz':
      return (
        <QuizPanel
          questions={buildQuizSetFromNotes(bundle)}
          courseId={progressKey}
          courseTitle={courseTitle}
          concept={bundle.concept}
          progressKey={progressKey}
        />
      );
    default:
      return null;
  }
}

export default function StudyWorkspace({ onRequestUpload }: { onRequestUpload?: () => void }) {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { courses, uploadedFiles, getCourse } = useLibraryStore();
  const course = courseId ? getCourse(courseId) : courses[0];
  const [activeTool, setActiveTool] = useState<WorkspaceToolId>('reader');
  const [stepIndex, setStepIndex] = useState(0);
  const [ydoc] = useState(() => new Y.Doc());
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  const progressKey = course?.id ?? 'default';

  const bundle = useMemo(
    () => buildWorkspaceNoteBundle(uploadedFiles, course ?? null, course?.topics[0]?.title),
    [uploadedFiles, course],
  );

  const steps = useMemo(() => buildWorkspaceStepsFromNotes(bundle), [bundle]);
  const currentStep = steps[stepIndex];
  const lessonContent = currentStep
    ? getNoteContentForLessonStep(bundle, stepIndex, currentStep.kind)
    : null;
  const quizQuestions = useMemo(() => buildQuizSetFromNotes(bundle), [bundle]);

  // Restore workspace session on mount
  useEffect(() => {
    const saved = loadWorkspaceSession(progressKey);
    if (saved) {
      setActiveTool(saved.activeTool);
      setStepIndex(saved.stepIndex);
    }
    const savedBus = loadBusFromStorage(progressKey);
    if (savedBus) loadConceptBus(savedBus);
  }, [progressKey]);

  // Persist workspace session on change
  useEffect(() => {
    const timer = setTimeout(() => {
      saveWorkspaceSession(progressKey, {
        courseId: course?.id ?? '',
        activeTool,
        stepIndex,
        conceptBus: serializeConceptBus(),
        timerElapsed: 0,
        lastAccessed: Date.now(),
        toolStates: {},
      });
      saveConceptBus(progressKey, serializeConceptBus());
    }, 1000);
    return () => clearTimeout(timer);
  }, [progressKey, activeTool, stepIndex, course?.id]);

  useEffect(() => {
    if (bundle.hasSource) logActivity(`Study workspace: ${course?.title ?? 'course'}`, 'study');
  }, [bundle.hasSource, course?.title]);

  // Emit concept activity when step changes
  useEffect(() => {
    if (currentStep && bundle.hasSource) {
      noteConceptActivity(currentStep.title, activeTool, 'read');
      emitFocus(currentStep.title, activeTool);
    }
  }, [currentStep, activeTool, bundle.hasSource]);

  // Enhanced keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const shortcut = matchShortcut(e);
    if (!shortcut) return;

    const { type, value } = parseShortcutAction(shortcut.action);
    if (type === 'tool') {
      setActiveTool(value as WorkspaceToolId);
      e.preventDefault();
    } else if (type === 'step') {
      if (value === 'prev') setStepIndex((i) => Math.max(0, i - 1));
      else if (value === 'next') setStepIndex((i) => Math.min(steps.length - 1, i + 1));
      else if (value === 'first') setStepIndex(0);
      else if (value === 'last') setStepIndex(steps.length - 1);
      e.preventDefault();
    } else if (value === 'keyboard-help') {
      setShowKeyboardHelp((v) => !v);
      e.preventDefault();
    }
  }, [steps.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleUpload = useCallback(() => {
    onRequestUpload?.() ?? navigate('/library');
  }, [onRequestUpload, navigate]);

  const handleFocusConcept = useCallback((concept: string) => {
    emitFocus(concept, activeTool);
  }, [activeTool]);

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <p className="text-slate-500 mb-4">{t('No course found. Upload material first.', 'Δεν βρέθηκε μάθημα. Ανέβασε υλικό πρώτα.')}</p>
        <button onClick={() => navigate('/library')} className="text-indigo-600 font-semibold">{t('Go to Library', 'Μετάβαση στη Βιβλιοθήκη')}</button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)] flex flex-col bg-slate-50 dark:bg-slate-950 w-full">
      {/* Compact header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/60 dark:border-slate-800/60 glass-card">
        <button onClick={() => navigate('/library')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all" title={t('Back to Library', 'Πίσω στη Βιβλιοθήκη')}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-display font-bold text-slate-900 dark:text-white truncate tracking-tight">{course.title}</h1>
          <p className="text-xs text-slate-500 font-medium">{t('Study Workspace', 'Χώρος Μελέτης')} · {bundle.concept}</p>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Vertical dock — hidden on mobile */}
        <div className="hidden md:block">
          <WorkspaceDock
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            onShowKeyboardHelp={() => setShowKeyboardHelp((v) => !v)}
          />
        </div>

        {/* Main content area */}
        {!bundle.hasSource ? (
          <div className="flex-1">
            <WorkspaceEmptyState toolId={activeTool} hasSource={false} onUpload={handleUpload} />
          </div>
        ) : (
          <PanelGroup orientation="horizontal" className="flex-1">
            {/* Left panel: Lesson steps */}
            <Panel defaultSize={40} minSize={25}>
              <div className="h-full overflow-y-auto p-5 border-r border-slate-200/60 dark:border-slate-800/60">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-white tracking-tight">{t('Lesson Steps', 'Βήματα Μαθήματος')}</h2>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={stepIndex === 0} className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-xs text-slate-500 self-center tabular-nums font-medium">{stepIndex + 1}/{steps.length}</span>
                    <button onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))} disabled={stepIndex >= steps.length - 1} className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Step cards */}
                <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
                  {steps.map((step, i) => (
                    <button
                      key={step.id}
                      onClick={() => setStepIndex(i)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                        i === stepIndex
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : i < stepIndex
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-transparent'
                      }`}
                    >
                      {step.kind}
                    </button>
                  ))}
                </div>

                {lessonContent && (
                  <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-4 shadow-sm">
                    <span className="text-xs font-display font-bold uppercase text-indigo-600 dark:text-indigo-400 tracking-tight">{currentStep?.kind}</span>
                    <h3 className="font-display font-bold text-slate-900 dark:text-white mt-1.5 mb-2 text-sm tracking-tight">{lessonContent.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">{lessonContent.body}</p>
                  </div>
                )}
                {quizQuestions.length > 0 && currentStep?.id === 'quiz' && (
                  <div className="mt-4">
                    <QuizStepPanel
                      questions={quizQuestions}
                      courseId={courseId ?? course.id}
                      courseTitle={course.title}
                      concept={bundle.concept}
                    />
                  </div>
                )}
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-indigo-400 transition-colors cursor-col-resize" />

            {/* Right panel: Active tool */}
            <Panel defaultSize={60} minSize={30}>
              <div className="h-full overflow-hidden bg-white dark:bg-slate-900 flex flex-col">
                <div className="flex-1 overflow-auto">
                  <ToolPanel
                    toolId={activeTool}
                    bundle={bundle}
                    ydoc={ydoc}
                    courseTitle={course.title}
                    onSelectTool={setActiveTool}
                    onUpload={handleUpload}
                    progressKey={progressKey}
                  />
                </div>
              </div>
            </Panel>
          </PanelGroup>
        )}
      </div>

      {/* Concept Lens Bar — cross-tool coherence */}
      {bundle.hasSource && (
        <ConceptLensBar activeTool={activeTool} onFocusConcept={handleFocusConcept} />
      )}

      {/* Mobile tool bar */}
      <div className="md:hidden flex gap-1.5 overflow-x-auto p-3 border-t border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900">
        {(['reader', 'leitner', 'concept-map', 'feynman', 'quiz', 'timer', 'whiteboard', 'scratchpad', 'source', 'dashboard'] as WorkspaceToolId[]).map((toolId) => (
          <button
            key={toolId}
            onClick={() => setActiveTool(toolId)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              activeTool === toolId ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-transparent'
            }`}
          >
            {toolId.split('-').map((w) => w[0].toUpperCase()).join('')}
          </button>
        ))}
      </div>

      {/* Keyboard help overlay */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowKeyboardHelp(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto border border-slate-200/60 dark:border-slate-800/60" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white mb-4 tracking-tight">{t('Keyboard Shortcuts', 'Συντομεύσεις Πληκτρολογίου')}</h2>
            <div className="space-y-3">
              {[
                { keys: '1–9, 0', desc: t('Switch tools', 'Εναλλαγή εργαλείων') },
                { keys: '← →', desc: t('Navigate steps', 'Πλοήγηση βημάτων') },
                { keys: 'Home / End', desc: t('First / Last step', 'Πρώτο / Τελευταίο βήμα') },
                { keys: 'Shift+?', desc: t('Toggle this help', 'Εμφάνιση βοήθειας') },
              ].map((s) => (
                <div key={s.keys} className="flex items-center justify-between">
                  <kbd className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-700">{s.keys}</kbd>
                  <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{s.desc}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowKeyboardHelp(false)} className="mt-5 w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-semibold transition-all">{t('Close', 'Κλείσιμο')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
