import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Upload, Sparkles } from 'lucide-react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import * as Y from 'yjs';
import { useLibraryStore } from '../../store/useLibraryStore';
import {
  buildWorkspaceNoteBundle,
  buildWorkspaceStepsFromNotes,
  type WorkspaceToolId,
} from '../../lib/workspaceNoteContent';
import { getNoteContentForLessonStep, buildQuizFromNotes } from '../../lib/groundedLesson';
import { WORKSPACE_TOOLS } from '../../lib/workspaceToolRegistry';
import CompactPomodoroTimer from '../CompactPomodoroTimer';
import Whiteboard from '../Whiteboard';
import { logActivity } from '../../lib/activity';

function EmptySourceState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <Upload className="w-12 h-12 text-slate-300 mb-4" />
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No source material</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
        Upload PDF or text files (≥80 characters) to enable all 11 grounded study tools.
      </p>
      <button onClick={onUpload} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700">
        Upload Material
      </button>
    </div>
  );
}

function SourceIntelligenceCard({ bundle, onSelectTool }: { bundle: ReturnType<typeof buildWorkspaceNoteBundle>; onSelectTool: (id: WorkspaceToolId) => void }) {
  const si = bundle.sourceIntelligence;
  const bandColor = si.band === 'strong' ? 'text-emerald-600' : si.band === 'moderate' ? 'text-amber-600' : 'text-rose-600';
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase text-slate-500">Source Intelligence</span>
        <span className={`text-sm font-bold ${bandColor}`}>{si.score}/100 · {si.band}</span>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{si.reason}</p>
      {si.strengths.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {si.strengths.map((s) => (
            <span key={s} className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-lg">{s}</span>
          ))}
        </div>
      )}
      <button
        onClick={() => onSelectTool(si.bestTool)}
        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1"
      >
        <Sparkles className="w-3 h-3" /> Open recommended: {si.bestTool}
      </button>
    </div>
  );
}

function ToolPanel({
  toolId,
  bundle,
  ydoc,
}: {
  toolId: WorkspaceToolId;
  bundle: ReturnType<typeof buildWorkspaceNoteBundle>;
  ydoc: Y.Doc;
}) {
  if (!bundle.hasSource) return null;

  switch (toolId) {
    case 'concept-map':
      return (
        <div className="space-y-3 overflow-auto max-h-full p-2">
          <h4 className="font-semibold text-sm">Concept Map ({bundle.conceptMap.nodes.length} nodes)</h4>
          <div className="grid gap-2">
            {bundle.conceptMap.nodes.map((n) => (
              <div key={n.id} className="px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-sm font-medium">{n.label}</div>
            ))}
          </div>
          <div className="text-xs text-slate-500">{bundle.conceptMap.edges.length} prerequisite edges</div>
        </div>
      );
    case 'sandbox':
      return (
        <div className="p-4 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">{bundle.sandboxInsight}</p>
          {bundle.economicsSandbox && (
            <div className="space-y-3">
              {['Price', 'Quantity', 'Cost'].map((label) => (
                <div key={label}>
                  <label className="text-xs font-semibold text-slate-500">{label}</label>
                  <input type="range" min={0} max={100} defaultValue={50} className="w-full" />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    case 'leitner':
      return (
        <div className="p-4 space-y-3 overflow-auto max-h-full">
          {bundle.flashcards.slice(0, 10).map((c, i) => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.question}</p>
              <p className="text-xs text-slate-500 mt-2">{c.answer}</p>
            </div>
          ))}
        </div>
      );
    case 'compare':
      return (
        <div className="p-4 overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2">A</th><th className="text-left py-2">B</th><th className="text-left py-2">Dimension</th></tr></thead>
            <tbody>
              {bundle.comparisons.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-2">{r.left}</td>
                  <td className="py-2 pr-2">{r.right}</td>
                  <td className="py-2 text-slate-500">{r.dimension}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'whiteboard':
      return <div className="h-[400px]"><Whiteboard ydoc={ydoc} /></div>;
    case 'feynman':
      return (
        <div className="p-4 space-y-4">
          <ol className="list-decimal list-inside text-sm space-y-2">
            {bundle.feynman.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <div>
            <h4 className="text-xs font-semibold text-slate-500 mb-2">Knowledge gaps to check</h4>
            {bundle.feynman.gaps.map((g, i) => (
              <p key={i} className="text-xs text-amber-700 dark:text-amber-400 mb-1">• {g}</p>
            ))}
          </div>
          <textarea placeholder="Explain the concept in your own words..." className="w-full h-24 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3" />
        </div>
      );
    case 'timer':
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <CompactPomodoroTimer />
          <p className="text-xs text-slate-500 mt-4">Session time is logged to your activity stream.</p>
        </div>
      );
    case 'debate':
      return (
        <div className="p-4 space-y-4 overflow-auto">
          {bundle.debate.map((d) => (
            <div key={d.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-sm font-semibold">{d.claim}</p>
              <p className="text-xs text-emerald-600 mt-2">Support: {d.support.join('; ')}</p>
              <p className="text-xs text-rose-600 mt-1">Counter: {d.counter.join('; ')}</p>
            </div>
          ))}
        </div>
      );
    case 'reader':
      return (
        <div className="p-4 overflow-auto max-h-full prose prose-sm dark:prose-invert">
          {bundle.sections.length > 0 ? (
            bundle.sections.map((sec) => (
              <div key={sec.id} className="mb-4">
                <h4 className="font-semibold text-indigo-600 dark:text-indigo-400">{sec.title}</h4>
                <p className="text-sm whitespace-pre-wrap">{sec.body.slice(0, 600)}{sec.body.length > 600 ? '…' : ''}</p>
              </div>
            ))
          ) : (
            <p className="text-sm whitespace-pre-wrap">{bundle.readerExcerpt}</p>
          )}
        </div>
      );
    case 'scratchpad':
      return (
        <div className="p-4 space-y-2">
          <h4 className="text-xs font-semibold text-slate-500">Formulas from notes</h4>
          {bundle.formulas.length === 0 ? (
            <p className="text-sm text-slate-500">No formulas detected in source.</p>
          ) : (
            bundle.formulas.map((f, i) => (
              <code key={i} className="block text-sm bg-slate-100 dark:bg-slate-800 p-2 rounded-lg font-mono">{f}</code>
            ))
          )}
        </div>
      );
    case 'source':
      return (
        <div className="p-4 space-y-3 overflow-auto">
          <SourceIntelligenceCard bundle={bundle} onSelectTool={() => {}} />
          <p className="text-xs text-slate-500">{bundle.sourceText.length} characters indexed</p>
          {bundle.course?.sourceQuality && (
            <div className="text-sm">
              <p>Quality: {bundle.course.sourceQuality.score}/100 ({bundle.course.sourceQuality.band})</p>
              {bundle.course.sourceQuality.warnings.map((w) => (
                <p key={w} className="text-xs text-amber-600 mt-1">⚠ {w}</p>
              ))}
            </div>
          )}
        </div>
      );
    default:
      return null;
  }
}

export default function StudyWorkspace({ onRequestUpload }: { onRequestUpload?: () => void }) {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { courses, uploadedFiles, getCourse } = useLibraryStore();
  const course = courseId ? getCourse(courseId) : courses[0];
  const [activeTool, setActiveTool] = useState<WorkspaceToolId>('reader');
  const [stepIndex, setStepIndex] = useState(0);
  const [ydoc] = useState(() => new Y.Doc());

  const bundle = useMemo(
    () => buildWorkspaceNoteBundle(uploadedFiles, course ?? null, course?.topics[0]?.title),
    [uploadedFiles, course],
  );

  const steps = useMemo(() => buildWorkspaceStepsFromNotes(bundle), [bundle]);
  const currentStep = steps[stepIndex];
  const lessonContent = currentStep
    ? getNoteContentForLessonStep(bundle, stepIndex, currentStep.kind)
    : null;
  const quiz = buildQuizFromNotes(bundle);

  useEffect(() => {
    if (bundle.hasSource) logActivity(`Study workspace: ${course?.title ?? 'course'}`, 'study');
  }, [bundle.hasSource, course?.title]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'ArrowLeft') setStepIndex((i) => Math.max(0, i - 1));
    if (e.key === 'ArrowRight') setStepIndex((i) => Math.min(steps.length - 1, i + 1));
    const tool = WORKSPACE_TOOLS.find((t) => t.shortcut === e.key);
    if (tool) setActiveTool(tool.id);
  }, [steps.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <p className="text-slate-500 mb-4">No course found. Upload material first.</p>
        <button onClick={() => navigate('/library')} className="text-indigo-600 font-semibold">Go to Library</button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50 dark:bg-slate-950">
      <header className="flex items-center gap-4 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <button onClick={() => navigate('/library')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-slate-900 dark:text-white truncate">{course.title}</h1>
          <p className="text-xs text-slate-500">Study Workspace · {bundle.concept}</p>
        </div>
        <div className="hidden md:flex gap-1 overflow-x-auto">
          {WORKSPACE_TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              title={`${t.label} (${t.shortcut})`}
              className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTool === t.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {t.shortLabel}
            </button>
          ))}
        </div>
      </header>

      {!bundle.hasSource ? (
        <EmptySourceState onUpload={() => onRequestUpload?.() ?? navigate('/library')} />
      ) : (
        <PanelGroup orientation="horizontal" className="flex-1">
          <Panel defaultSize={45} minSize={30}>
            <div className="h-full overflow-y-auto p-4 border-r border-slate-200 dark:border-slate-800">
              <SourceIntelligenceCard bundle={bundle} onSelectTool={setActiveTool} />
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Lesson Steps</h2>
                <div className="flex gap-1">
                  <button onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={stepIndex === 0} className="p-1 rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-xs text-slate-500 self-center">{stepIndex + 1}/{steps.length}</span>
                  <button onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))} disabled={stepIndex >= steps.length - 1} className="p-1 rounded disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
              {lessonContent && (
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
                  <span className="text-xs font-semibold text-indigo-600">{currentStep?.kind}</span>
                  <h3 className="font-bold text-slate-900 dark:text-white mt-1 mb-2">{lessonContent.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{lessonContent.body}</p>
                </div>
              )}
              {quiz && currentStep?.id === 'quiz' && (
                <div className="mt-4 rounded-xl border border-indigo-200 dark:border-indigo-800 p-4">
                  <p className="text-sm font-semibold mb-3">{quiz.question}</p>
                  {quiz.options.map((opt, i) => (
                    <button key={i} className="block w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 mb-1">{opt}</button>
                  ))}
                </div>
              )}
            </div>
          </Panel>
          <PanelResizeHandle className="w-1 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-400 transition-colors" />
          <Panel defaultSize={55} minSize={30}>
            <div className="h-full overflow-hidden bg-white dark:bg-slate-900">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {WORKSPACE_TOOLS.find((t) => t.id === activeTool)?.label}
                </h3>
              </div>
              <div className="h-[calc(100%-2.5rem)] overflow-auto">
                <ToolPanel toolId={activeTool} bundle={bundle} ydoc={ydoc} />
              </div>
            </div>
          </Panel>
        </PanelGroup>
      )}

      {/* Mobile tool bar */}
      <div className="md:hidden flex gap-1 overflow-x-auto p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {WORKSPACE_TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTool === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            {t.shortLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
