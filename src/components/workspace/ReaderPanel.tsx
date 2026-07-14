import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, BookOpen, ChevronRight, Highlighter, Volume2, Square, Flame } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { noteConceptActivity, subscribeConceptBus } from '../../lib/workspaceConceptBus';
import { subscribeFocus, type FocusEvent } from '../../lib/workspaceFocus';
import { speakParagraphs, toSpeakableParagraphs, isTtsSupported, type ReaderTtsController } from '../../lib/readerTts';
import { computeSectionHeat, readerHeatLevelClass } from '../../lib/readerLearningHeatmap';
import WorkspaceToolHeader from './WorkspaceToolHeader';
import AnnotationOverlay from './AnnotationOverlay';

interface Section { id: string; title: string; body: string; }

interface ReaderPanelProps {
  sections: Section[];
  readerExcerpt: string;
  sourceText: string;
  progressKey: string;
}

function highlightTerm(text: string, term: string): React.ReactNode {
  if (!term) return text;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-700/50 rounded px-0.5">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
}

export default function ReaderPanel({ sections, readerExcerpt, sourceText, progressKey }: ReaderPanelProps) {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [focusTerm, setFocusTerm] = useState<string>('');
  const [speakingSectionId, setSpeakingSectionId] = useState<string | null>(null);
  const [heatVersion, setHeatVersion] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const ttsRef = useRef<ReaderTtsController | null>(null);

  useEffect(() => {
    const unsub = subscribeFocus((ev: FocusEvent | null) => {
      if (ev?.highlight) setFocusTerm(ev.term);
      else setFocusTerm('');
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeConceptBus(() => setHeatVersion((v) => v + 1));
    return unsub;
  }, []);

  useEffect(() => () => ttsRef.current?.stop(), []);

  const stopSpeaking = useCallback(() => {
    ttsRef.current?.stop();
    ttsRef.current = null;
    setSpeakingSectionId(null);
  }, []);

  const toggleSpeakSection = useCallback((id: string, body: string, title: string) => {
    if (speakingSectionId === id) {
      stopSpeaking();
      return;
    }
    ttsRef.current?.stop();
    const controller = speakParagraphs(toSpeakableParagraphs(`${title}. ${body}`), {
      lang: language,
      onEnd: () => setSpeakingSectionId((cur) => (cur === id ? null : cur)),
    });
    if (controller) {
      ttsRef.current = controller;
      setSpeakingSectionId(id);
    }
  }, [speakingSectionId, stopSpeaking, language]);

  const scrollToSection = useCallback((id: string) => {
    setActiveSection(id);
    const el = contentRef.current?.querySelector(`[data-section-id="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const section = sections.find((s) => s.id === id);
    if (section) noteConceptActivity(section.title, 'reader', 'read');
  }, [sections]);

  const term = focusTerm || search;
  const hasSections = sections.length > 0;
  // Recomputed on every concept-bus update via heatVersion re-render trigger.
  void heatVersion;

  return (
    <div className="flex flex-col h-full">
      <WorkspaceToolHeader toolId="reader">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search source…', 'Αναζήτηση πηγής…')}
            className="pl-8 pr-3 py-1.5 text-xs border rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 w-44 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
        </div>
      </WorkspaceToolHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* Section sidebar */}
        {hasSections && (
          <div className="w-52 border-r border-slate-200/60 dark:border-slate-800/60 overflow-y-auto flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="p-3">
              <h4 className="text-xs font-display font-bold uppercase text-slate-400 px-2 py-1.5 tracking-tight">{t('Sections', 'Ενότητες')}</h4>
              {sections.map((sec) => {
                const heat = computeSectionHeat(sec.title, sec.body);
                return (
                  <button
                    key={sec.id}
                    onClick={() => scrollToSection(sec.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center gap-1.5 ${
                      activeSection === sec.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800/50'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate font-medium flex-1">{sec.title}</span>
                    {heat.level !== 'none' && (
                      <span title={t('Weak spot — you\'ve struggled with concepts here', 'Αδύναμο σημείο — έχεις δυσκολευτεί εδώ')}>
                        <Flame
                          className={`w-3 h-3 flex-shrink-0 ${
                            heat.level === 'high' ? 'text-rose-500' : heat.level === 'medium' ? 'text-amber-500' : 'text-indigo-400'
                          }`}
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content area */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-5 prose prose-sm dark:prose-invert max-w-none">
          {hasSections ? (
            sections.map((sec) => {
              const heat = computeSectionHeat(sec.title, sec.body);
              const isSpeaking = speakingSectionId === sec.id;
              return (
                <div
                  key={sec.id}
                  data-section-id={sec.id}
                  className={`mb-8 scroll-mt-4 rounded-lg pl-3 -ml-3 transition-colors ${readerHeatLevelClass(heat.level)}`}
                >
                  <h4 className="font-display font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 mb-3 tracking-tight">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <span className="flex-1">{highlightTerm(sec.title, term)}</span>
                    {isTtsSupported() && (
                      <button
                        onClick={() => toggleSpeakSection(sec.id, sec.body, sec.title)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isSpeaking
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                        }`}
                        title={isSpeaking ? t('Stop reading', 'Διακοπή ανάγνωσης') : t('Read aloud', 'Ανάγνωση δυνατά')}
                      >
                        {isSpeaking ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </h4>
                  <AnnotationOverlay sectionId={sec.id} body={sec.body} progressKey={progressKey} focusTerm={term} />
                </div>
              );
            })
          ) : (
            <AnnotationOverlay sectionId="source-excerpt" body={readerExcerpt || sourceText.slice(0, 3000)} progressKey={progressKey} focusTerm={term} />
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="px-4 py-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center gap-3 text-xs text-slate-400 font-medium">
        <span>{sourceText.length.toLocaleString()} {t('characters', 'χαρακτήρες')}</span>
        {hasSections && <span>{sections.length} {t('sections', 'ενότητες')}</span>}
        {focusTerm && (
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <div className="w-4 h-4 rounded bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
              <Highlighter className="w-2.5 h-2.5" />
            </div>
            {focusTerm}
          </span>
        )}
      </div>
    </div>
  );
}
