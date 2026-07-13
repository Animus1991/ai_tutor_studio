import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  Trophy,
  RotateCcw,
  BarChart3,
  Zap,
  Target,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { QuizQuestion } from '../../lib/groundedLesson';
import { shuffleQuizQuestion } from '../../lib/groundedLesson';
import { saveQuizScore } from '../../lib/quizStorage';
import {
  loadQuizIrt,
  recordQuizResponse,
  buildQuizIrtDisplay,
  type QuizIrtState,
  type QuizIrtDisplay,
} from '../../lib/quizIrt';
import { noteConceptActivity } from '../../lib/workspaceConceptBus';
import { useStore } from '../../store/useStore';
import { useLanguage } from '../../lib/i18n';
import { logActivity } from '../../lib/activity';
import { toast } from 'sonner';
import WorkspaceToolHeader from './WorkspaceToolHeader';
import QuizIrtBadge from './QuizIrtBadge';

// ── Types ──────────────────────────────────────────────────────────

interface QuizPanelProps {
  questions: QuizQuestion[];
  courseId: string;
  courseTitle?: string;
  concept?: string;
  progressKey: string;
}

type ConfidenceLevel = 1 | 2 | 3 | 4;

interface AnswerRecord {
  questionId: string;
  selected: number;
  correct: boolean;
  confidence: ConfidenceLevel;
  timeMs: number;
}

// ── Confidence selector ────────────────────────────────────────────

const CONFIDENCE_LEVELS: { level: ConfidenceLevel; en: string; el: string; color: string }[] = [
  { level: 1, en: 'Guessing', el: 'Μαντεύω', color: 'border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20' },
  { level: 2, en: 'Uncertain', el: 'Αβέβαιος', color: 'border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20' },
  { level: 3, en: 'Fairly sure', el: 'Αρκετά σίγουρος', color: 'border-cyan-300 dark:border-cyan-700 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20' },
  { level: 4, en: 'Certain', el: 'Σίγουρος', color: 'border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' },
];

const CONFIDENCE_ACTIVE: Record<ConfidenceLevel, string> = {
  1: 'bg-rose-100 dark:bg-rose-900/30 border-rose-400 dark:border-rose-600',
  2: 'bg-amber-100 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600',
  3: 'bg-cyan-100 dark:bg-cyan-900/30 border-cyan-400 dark:border-cyan-600',
  4: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-600',
};

function ConfidenceSelector({
  value,
  onChange,
  disabled,
}: {
  value: ConfidenceLevel | null;
  onChange: (level: ConfidenceLevel) => void;
  disabled: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="mb-3">
      <p className="text-xs uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1.5">
        {t('Confidence', 'Βεβαιότητα')}
      </p>
      <div className="flex gap-1.5">
        {CONFIDENCE_LEVELS.map((cl) => (
          <button
            key={cl.level}
            type="button"
            disabled={disabled}
            onClick={() => onChange(cl.level)}
            className={cn(
              'flex-1 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200',
              value === cl.level ? CONFIDENCE_ACTIVE[cl.level] : cl.color,
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {t(cl.en, cl.el)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Session summary ────────────────────────────────────────────────

function SessionSummary({
  answers,
  total,
  irt,
  irtResponseCount,
  onRetry,
}: {
  answers: AnswerRecord[];
  total: number;
  irt: QuizIrtDisplay | null;
  irtResponseCount: number;
  onRetry: () => void;
}) {
  const { t } = useLanguage();
  const correct = answers.filter((a) => a.correct).length;
  const pct = Math.round((correct / total) * 100);
  const avgTime = Math.round(answers.reduce((s, a) => s + a.timeMs, 0) / answers.length / 1000);
  const avgConfidence = answers.reduce((s, a) => s + a.confidence, 0) / answers.length;

  const calibration = answers.filter((a) => {
    const expectCorrect = a.confidence >= 3;
    return expectCorrect === a.correct;
  }).length;
  const calibrationPct = Math.round((calibration / answers.length) * 100);

  return (
    <div className="p-5 animate-fade-in-up">
      <div className="text-center mb-5">
        <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white tracking-tight">
          {t('Quiz Complete!', 'Κουίζ Ολοκληρώθηκε!')}
        </h3>
        <p className="text-3xl font-display font-bold text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">
          {correct}/{total}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {pct >= 80
            ? t('Excellent mastery!', 'Εξαιρετική κατάκτηση!')
            : pct >= 50
              ? t('Good effort — review the gaps.', 'Καλή προσπάθεια — εξέτασε τα κενά.')
              : t('Keep studying and retry.', 'Συνέχισε τη μελέτη και δοκίμασε ξανά.')}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-3 text-center bg-white dark:bg-slate-900">
          <BarChart3 className="w-4 h-4 mx-auto mb-1 text-indigo-500" />
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{pct}%</p>
          <p className="text-xs text-slate-500 font-medium">{t('Accuracy', 'Ακρίβεια')}</p>
        </div>
        <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-3 text-center bg-white dark:bg-slate-900">
          <Zap className="w-4 h-4 mx-auto mb-1 text-amber-500" />
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{avgTime}s</p>
          <p className="text-xs text-slate-500 font-medium">{t('Avg. time', 'Μέσος χρόνος')}</p>
        </div>
        <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-3 text-center bg-white dark:bg-slate-900">
          <Target className="w-4 h-4 mx-auto mb-1 text-cyan-500" />
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{calibrationPct}%</p>
          <p className="text-xs text-slate-500 font-medium">{t('Calibration', 'Βαθμονόμηση')}</p>
        </div>
      </div>

      {/* Confidence calibration info */}
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-3 mb-4 bg-slate-50 dark:bg-slate-900/50">
        <p className="text-xs uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-2">
          {t('Confidence Calibration', 'Βαθμονόμηση Βεβαιότητας')}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {calibrationPct >= 80
            ? t('Your confidence matches your performance well.', 'Η βεβαιότητά σου ταιριάζει καλά με την απόδοσή σου.')
            : calibrationPct >= 50
              ? t('Your confidence partially matches your actual knowledge.', 'Η βεβαιότητά σου ταιριάζει μερικώς με τις γνώσεις σου.')
              : avgConfidence > 2.5
                ? t('You tend to overestimate your certainty — slow down on uncertain items.', 'Τείνεις να υπερεκτιμάς τη βεβαιότητά σου — πρόσεχε στα αβέβαια.')
                : t('You tend to underestimate yourself — trust your knowledge more.', 'Τείνεις να υποτιμάς τον εαυτό σου — εμπιστέψου τις γνώσεις σου.')}
        </p>
      </div>

      {/* IRT badge */}
      {irt && <QuizIrtBadge irt={irt} responseCount={irtResponseCount} />}

      {/* Per-question review */}
      <div className="space-y-2 mb-5">
        <p className="text-xs uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
          {t('Question Review', 'Ανασκόπηση Ερωτήσεων')}
        </p>
        {answers.map((a, i) => (
          <div
            key={a.questionId}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs',
              a.correct
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
                : 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10',
            )}
          >
            {a.correct ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            )}
            <span className="flex-1 text-slate-700 dark:text-slate-300 font-medium">
              {t('Q', 'Ε')}{i + 1}
            </span>
            <span className="tabular-nums text-slate-500">{Math.round(a.timeMs / 1000)}s</span>
            <span className={cn(
              'text-xs font-semibold px-1.5 py-0.5 rounded',
              a.confidence >= 3 ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500',
            )}>
              {CONFIDENCE_LEVELS[a.confidence - 1] ? t(CONFIDENCE_LEVELS[a.confidence - 1].en, CONFIDENCE_LEVELS[a.confidence - 1].el) : ''}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
      >
        <RotateCcw className="w-4 h-4" />
        {t('Retry Quiz', 'Επανάληψη Κουίζ')}
      </button>
    </div>
  );
}

// ── Main QuizPanel ─────────────────────────────────────────────────

export default function QuizPanel({
  questions,
  courseId,
  courseTitle,
  concept,
  progressKey,
}: QuizPanelProps) {
  const { t } = useLanguage();
  const addXP = useStore((s) => s.addXP);

  const shuffledQuestions = useMemo(
    () => questions.map((q) => shuffleQuizQuestion(q)),
    [questions],
  );

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [finished, setFinished] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [irtState, setIrtState] = useState<QuizIrtState | null>(null);
  const [irtDisplay, setIrtDisplay] = useState<QuizIrtDisplay | null>(null);

  const irtScopeKey = `${progressKey}-quiz`;

  // Load IRT state on mount
  useEffect(() => {
    loadQuizIrt(irtScopeKey).then((state) => {
      setIrtState(state);
      const display = buildQuizIrtDisplay(
        shuffledQuestions[0]?.options.length ?? 4,
        state.ability,
      );
      setIrtDisplay(display);
    });
  }, [irtScopeKey, shuffledQuestions]);

  const current = shuffledQuestions[index];
  const answered = selected !== null;
  const isCorrect = answered && selected === current?.correctIndex;
  const canProceed = answered && confidence !== null;

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (answered) return;
      setSelected(optionIndex);
    },
    [answered],
  );

  const handleConfirm = useCallback(async () => {
    if (!canProceed || !current) return;

    const correct = selected === current.correctIndex;
    const timeMs = Date.now() - questionStartTime;

    const record: AnswerRecord = {
      questionId: current.id,
      selected: selected!,
      correct,
      confidence: confidence!,
      timeMs,
    };

    const newAnswers = [...answers, record];
    setAnswers(newAnswers);

    // IRT update
    const updatedIrt = await recordQuizResponse(
      irtScopeKey,
      current.options.length,
      correct,
    );
    setIrtState(updatedIrt);

    // Concept bus signals
    const conceptLabel = concept ?? courseTitle ?? courseId;
    noteConceptActivity(conceptLabel, 'quiz', correct ? 'quiz-correct' : 'quiz-wrong');

    // XP
    if (correct) addXP(15);

    // Move to next or finish
    if (index < shuffledQuestions.length - 1) {
      setIndex((i) => i + 1);
      setSelected(null);
      setConfidence(null);
      setQuestionStartTime(Date.now());

      // Update IRT display for next question
      const nextQ = shuffledQuestions[index + 1];
      if (nextQ) {
        setIrtDisplay(buildQuizIrtDisplay(nextQ.options.length, updatedIrt.ability));
      }
    } else {
      setFinished(true);
      const totalCorrect = newAnswers.filter((a) => a.correct).length;
      await saveQuizScore(courseId, totalCorrect, shuffledQuestions.length);
      logActivity(
        `Quiz completed: ${courseTitle ?? courseId} (${totalCorrect}/${shuffledQuestions.length})`,
        'study',
      );
      toast.success(
        t(
          `Quiz complete: ${totalCorrect}/${shuffledQuestions.length} correct`,
          `Κουίζ: ${totalCorrect}/${shuffledQuestions.length} σωστές`,
        ),
      );
      setIrtDisplay(buildQuizIrtDisplay(current.options.length, updatedIrt.ability));
    }
  }, [
    canProceed, current, selected, confidence, answers, index, shuffledQuestions,
    questionStartTime, irtScopeKey, concept, courseTitle, courseId, addXP, t,
  ]);

  const handleRetry = useCallback(() => {
    setIndex(0);
    setSelected(null);
    setConfidence(null);
    setAnswers([]);
    setFinished(false);
    setQuestionStartTime(Date.now());
  }, []);

  if (shuffledQuestions.length === 0) {
    return null; // empty state handled by StudyWorkspace
  }

  return (
    <div className="h-full flex flex-col">
      <WorkspaceToolHeader toolId="quiz" onReset={handleRetry} />

      <div className="flex-1 overflow-y-auto">
        {finished ? (
          <SessionSummary
            answers={answers}
            total={shuffledQuestions.length}
            irt={irtDisplay}
            irtResponseCount={irtState?.responses ?? 0}
            onRetry={handleRetry}
          />
        ) : current ? (
          <div className="p-5 animate-fade-in-up">
            {/* IRT badge — shows before answering */}
            {irtDisplay && (
              <QuizIrtBadge
                irt={irtDisplay}
                responseCount={irtState?.responses ?? 0}
                compact
              />
            )}

            {/* Progress bar */}
            <div className="mt-3 mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {t('Question', 'Ερώτηση')} {index + 1} {t('of', 'από')} {shuffledQuestions.length}
                </span>
                <span className="text-xs text-slate-500 tabular-nums font-medium">
                  {t('Score', 'Σκορ')}: {answers.filter((a) => a.correct).length}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${((index) / shuffledQuestions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question */}
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-4 shadow-sm mb-4">
              <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                {current.question}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-2 mb-4">
              {current.options.map((opt, i) => {
                let style = 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10';
                if (selected === i && !answered) {
                  style = 'border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-300 dark:ring-indigo-700';
                }
                if (answered) {
                  if (i === current.correctIndex) {
                    style = 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200';
                  } else if (i === selected) {
                    style = 'bg-rose-50 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200';
                  } else {
                    style = 'opacity-50 border-slate-200 dark:border-slate-700';
                  }
                }

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelect(i)}
                    disabled={answered}
                    className={cn(
                      'w-full text-left text-sm px-3 py-2.5 rounded-xl border transition-all duration-200 flex items-center gap-2.5',
                      style,
                    )}
                  >
                    <span className={cn(
                      'w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                      selected === i && !answered
                        ? 'border-indigo-500 bg-indigo-500 text-white'
                        : answered && i === current.correctIndex
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : answered && i === selected
                            ? 'border-rose-500 bg-rose-500 text-white'
                            : 'border-slate-300 dark:border-slate-600',
                    )}>
                      {answered && i === current.correctIndex ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : answered && i === selected && i !== current.correctIndex ? (
                        <XCircle className="w-3.5 h-3.5" />
                      ) : (
                        String.fromCharCode(65 + i)
                      )}
                    </span>
                    <span className="flex-1">{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* Feedback after answering */}
            {answered && (
              <div className={cn(
                'rounded-xl p-3 mb-4 border',
                isCorrect
                  ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800',
              )}>
                <p className={cn(
                  'text-sm font-semibold',
                  isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                )}>
                  {isCorrect
                    ? t('Correct! +15 XP', 'Σωστό! +15 XP')
                    : `${t('Incorrect', 'Λάθος')} — ${t('Correct answer:', 'Σωστή απάντηση:')} ${current.options[current.correctIndex]}`}
                </p>
              </div>
            )}

            {/* Confidence selector — always visible, usable before or after answer */}
            <ConfidenceSelector
              value={confidence}
              onChange={setConfidence}
              disabled={false}
            />

            {/* Confirm / Next button */}
            {selected !== null && (
              <button
                type="button"
                disabled={!canProceed}
                onClick={() => void handleConfirm()}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm',
                  canProceed
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed',
                )}
              >
                {index < shuffledQuestions.length - 1 ? (
                  <>
                    {t('Next Question', 'Επόμενη Ερώτηση')} <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  t('Finish Quiz', 'Ολοκλήρωση Κουίζ')
                )}
              </button>
            )}

            {!canProceed && selected !== null && (
              <p className="text-xs text-center text-slate-400 mt-2 font-medium">
                {t('Select your confidence level to proceed', 'Επίλεξε βαθμό βεβαιότητας για συνέχεια')}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
