import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MessageSquare, X, Trash2, AlertTriangle, FileCheck, BookMarked, Sparkles } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { noteConceptActivity } from '../../lib/workspaceConceptBus';
import {
  loadAnnotations,
  saveAnnotations,
  annotationsForSection,
  reanchorSectionAnnotations,
  type StoredAnnotation,
  type AnnotationCategory,
} from '../../lib/annotationStore';
import { getSelectionOffsetsInElement, segmentBodySpans } from '../../lib/annotationSpan';
import { MathText } from '../../lib/readerMath';

const HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fca5a5'];

const CATEGORY_META: Record<AnnotationCategory, { icon: typeof AlertTriangle; labelEn: string; labelEl: string }> = {
  general: { icon: BookMarked, labelEn: 'General', labelEl: 'Γενικό' },
  confusing: { icon: AlertTriangle, labelEn: 'Confusing', labelEl: 'Μπερδεμένο' },
  'exam-relevant': { icon: FileCheck, labelEn: 'Exam', labelEl: 'Εξέταση' },
  important: { icon: Sparkles, labelEn: 'Important', labelEl: 'Σημαντικό' },
  definition: { icon: BookMarked, labelEn: 'Definition', labelEl: 'Ορισμός' },
};

interface SelectionToolbarState {
  x: number;
  y: number;
  charStart: number;
  charEnd: number;
  excerpt: string;
}

interface AnnotationOverlayProps {
  sectionId: string;
  body: string;
  progressKey: string;
  focusTerm?: string;
}

function withFocusTerm(text: string, term: string | undefined): React.ReactNode {
  if (!term) return text;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-amber-200/60 dark:bg-amber-700/40 rounded px-0.5">{text.slice(idx, idx + term.length)}</span>
      {text.slice(idx + term.length)}
    </>
  );
}

export default function AnnotationOverlay({ sectionId, body, progressKey, focusTerm }: AnnotationOverlayProps) {
  const { t } = useLanguage();
  const contentRef = useRef<HTMLDivElement>(null);
  const [allAnnotations, setAllAnnotations] = useState<StoredAnnotation[]>(() => loadAnnotations(progressKey));
  const [selection, setSelection] = useState<SelectionToolbarState | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [activeAnnId, setActiveAnnId] = useState<string | null>(null);

  // Re-anchor this section's annotations whenever the body changes.
  useEffect(() => {
    setAllAnnotations((prev) => {
      const next = reanchorSectionAnnotations(prev, sectionId, body);
      saveAnnotations(progressKey, next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, body]);

  const annotations = useMemo(
    () => annotationsForSection(allAnnotations, sectionId),
    [allAnnotations, sectionId],
  );

  const persist = useCallback((next: StoredAnnotation[]) => {
    setAllAnnotations(next);
    saveAnnotations(progressKey, next);
  }, [progressKey]);

  const clearSelectionUi = useCallback(() => {
    setSelection(null);
    setShowCommentInput(false);
    setCommentDraft('');
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleMouseUp = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const offsets = getSelectionOffsetsInElement(el);
    if (!offsets || offsets.end - offsets.start < 1) return;
    const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect();
    const containerRect = el.getBoundingClientRect();
    const excerpt = body.slice(offsets.start, offsets.end);
    setActiveAnnId(null);
    setSelection({
      x: rect ? rect.left - containerRect.left + rect.width / 2 : 0,
      y: rect ? rect.top - containerRect.top : 0,
      charStart: offsets.start,
      charEnd: offsets.end,
      excerpt,
    });
  }, [body]);

  const addHighlight = useCallback((color: string) => {
    if (!selection) return;
    const ann: StoredAnnotation = {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sectionId,
      type: 'highlight',
      color,
      note: '',
      charStart: selection.charStart,
      charEnd: selection.charEnd,
      excerpt: selection.excerpt,
      category: 'general',
      anchorStatus: 'ok',
      createdAt: Date.now(),
    };
    persist([...allAnnotations, ann]);
    noteConceptActivity(selection.excerpt.slice(0, 40), 'reader', 'annotated');
    clearSelectionUi();
  }, [selection, sectionId, allAnnotations, persist, clearSelectionUi]);

  const confirmComment = useCallback(() => {
    if (!selection || !commentDraft.trim()) return;
    const ann: StoredAnnotation = {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sectionId,
      type: 'comment',
      color: HIGHLIGHT_COLORS[0]!,
      note: commentDraft.trim(),
      charStart: selection.charStart,
      charEnd: selection.charEnd,
      excerpt: selection.excerpt,
      category: 'general',
      anchorStatus: 'ok',
      createdAt: Date.now(),
    };
    persist([...allAnnotations, ann]);
    noteConceptActivity(selection.excerpt.slice(0, 40), 'reader', 'annotated');
    clearSelectionUi();
  }, [selection, commentDraft, sectionId, allAnnotations, persist, clearSelectionUi]);

  const removeAnnotation = useCallback((id: string) => {
    persist(allAnnotations.filter((a) => a.id !== id));
    setActiveAnnId(null);
  }, [allAnnotations, persist]);

  const setCategory = useCallback((id: string, category: AnnotationCategory) => {
    persist(allAnnotations.map((a) => (a.id === id ? { ...a, category } : a)));
  }, [allAnnotations, persist]);

  const spans = useMemo(
    () => segmentBodySpans(body.length, annotations.map((a) => ({
      id: a.id, color: a.color, charStart: a.charStart, charEnd: a.charEnd,
    }))),
    [body, annotations],
  );

  const activeAnn = activeAnnId ? annotations.find((a) => a.id === activeAnnId) : null;

  return (
    <div className="relative">
      <div
        ref={contentRef}
        onMouseUp={handleMouseUp}
        className="text-sm whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300 select-text"
      >
        {spans.map((seg, idx) => {
          const text = body.slice(seg.start, seg.end);
          if (!seg.color) {
            return (
              <span key={`plain-${idx}`}>
                <MathText text={text} renderText={(t) => withFocusTerm(t, focusTerm)} />
              </span>
            );
          }
          const ann = annotations.find((a) => a.id === seg.annotationId);
          const CategoryIcon = ann ? CATEGORY_META[ann.category].icon : null;
          return (
            <mark
              key={ann?.id ?? idx}
              onClick={(e) => { e.stopPropagation(); setSelection(null); setActiveAnnId(ann?.id ?? null); }}
              className="rounded px-0.5 cursor-pointer ring-1 ring-transparent hover:ring-slate-400/40 transition-all"
              style={{ backgroundColor: `${ann?.color ?? seg.color}66` }}
              title={ann?.note || undefined}
            >
              <MathText text={text} />
              {ann?.type === 'comment' && <MessageSquare className="inline w-2.5 h-2.5 ml-0.5 -translate-y-0.5 text-indigo-600" />}
              {ann && ann.category !== 'general' && CategoryIcon && (
                <CategoryIcon className="inline w-2.5 h-2.5 ml-0.5 -translate-y-0.5 text-amber-600" />
              )}
            </mark>
          );
        })}
      </div>

      {/* Selection toolbar */}
      {selection && (
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-full flex flex-col gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2"
          style={{ left: selection.x, top: Math.max(0, selection.y - 8) }}
        >
          {!showCommentInput ? (
            <div className="flex items-center gap-1">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => addHighlight(c)}
                  className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                  title={t('Highlight', 'Επισήμανση')}
                />
              ))}
              <button
                onClick={() => setShowCommentInput(true)}
                className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ml-0.5"
                title={t('Add comment', 'Προσθήκη σχολίου')}
              >
                <MessageSquare className="w-3 h-3 text-slate-600 dark:text-slate-300" />
              </button>
              <button
                onClick={clearSelectionUi}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 w-64">
              <input
                autoFocus
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmComment()}
                placeholder={t('Write a note…', 'Γράψε σχόλιο…')}
                className="flex-1 px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
              <button onClick={confirmComment} className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all">
                OK
              </button>
              <button onClick={clearSelectionUi} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active annotation popover */}
      {activeAnn && (
        <div className="absolute z-20 top-0 right-0 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-xs italic text-slate-500 dark:text-slate-400 line-clamp-2">"{activeAnn.excerpt}"</p>
            <button onClick={() => setActiveAnnId(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {activeAnn.note && (
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2.5 leading-relaxed">{activeAnn.note}</p>
          )}
          <div className="flex items-center gap-1 mb-2.5 flex-wrap">
            {(Object.keys(CATEGORY_META) as AnnotationCategory[]).map((cat) => {
              const Icon = CATEGORY_META[cat].icon;
              const active = activeAnn.category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(activeAnn.id, cat)}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    active
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600'
                  }`}
                  title={t(CATEGORY_META[cat].labelEn, CATEGORY_META[cat].labelEl)}
                >
                  <Icon className="w-3 h-3" />
                </button>
              );
            })}
          </div>
          <button
            onClick={() => removeAnnotation(activeAnn.id)}
            className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-medium"
          >
            <Trash2 className="w-3 h-3" /> {t('Delete', 'Διαγραφή')}
          </button>
        </div>
      )}
    </div>
  );
}
