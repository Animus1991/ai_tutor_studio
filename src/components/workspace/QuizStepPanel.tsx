import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, Trophy } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { QuizQuestion } from '../../lib/groundedLesson';
import { shuffleQuizQuestion } from '../../lib/groundedLesson';
import { saveQuizScore } from '../../lib/quizStorage';
import { useStore } from '../../store/useStore';
import { logActivity } from '../../lib/activity';
import { toast } from 'sonner';

type Props = {
  questions: QuizQuestion[];
  courseId: string;
  courseTitle?: string;
};

export default function QuizStepPanel({ questions, courseId, courseTitle }: Props) {
  const addXP = useStore((s) => s.addXP);
  const shuffledQuestions = useMemo(
    () => questions.map((q) => shuffleQuizQuestion(q)),
    [questions],
  );

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  if (shuffledQuestions.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Upload material with glossary terms to unlock quiz steps.
      </p>
    );
  }

  const current = shuffledQuestions[index];
  const answered = selected !== null;
  const isCorrect = answered && selected === current.correctIndex;

  const handleSelect = (optionIndex: number) => {
    if (answered) return;
    setSelected(optionIndex);
    const correct = optionIndex === current.correctIndex;
    if (correct) {
      setScore((s) => s + 1);
      addXP(15);
    }
  };

  const handleNext = async () => {
    if (index < shuffledQuestions.length - 1) {
      setIndex((i) => i + 1);
      setSelected(null);
      return;
    }

    const totalCorrect = score;
    setFinished(true);
    await saveQuizScore(courseId, totalCorrect, shuffledQuestions.length);
    logActivity(
      `Quiz completed: ${courseTitle ?? courseId} (${totalCorrect}/${shuffledQuestions.length})`,
      'study',
    );
    toast.success(`Quiz complete: ${totalCorrect}/${shuffledQuestions.length} correct`);
  };

  if (finished) {
    const pct = Math.round((score / shuffledQuestions.length) * 100);
    return (
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 p-5 text-center">
        <Trophy className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h4 className="font-bold text-slate-900 dark:text-white mb-1">Quiz Complete!</h4>
        <p className="text-2xl font-display font-bold text-indigo-600 dark:text-indigo-400 mb-2">
          {score}/{shuffledQuestions.length}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {pct >= 80 ? 'Excellent mastery!' : pct >= 50 ? 'Good effort — review the gaps.' : 'Keep studying and retry.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
          Question {index + 1} of {shuffledQuestions.length}
        </span>
        <span className="text-xs text-slate-500">Score: {score}</span>
      </div>
      <p className="text-sm font-semibold mb-3 text-slate-900 dark:text-white">{current.question}</p>
      <div className="space-y-2 mb-4">
        {current.options.map((opt, i) => {
          let style = 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-slate-200 dark:border-slate-700';
          if (answered) {
            if (i === current.correctIndex) {
              style = 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200';
            } else if (i === selected) {
              style = 'bg-rose-50 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200';
            } else {
              style = 'opacity-60 border-slate-200 dark:border-slate-700';
            }
          }
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => handleSelect(i)}
              className={cn(
                'block w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors',
                style,
              )}
            >
              <span className="flex items-center gap-2">
                {answered && i === current.correctIndex && (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                {answered && i === selected && i !== current.correctIndex && (
                  <XCircle className="w-4 h-4 shrink-0" />
                )}
                {opt}
              </span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mb-3">
          <p
            className={cn(
              'text-sm font-medium',
              isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
            )}
          >
            {isCorrect ? 'Correct! +15 XP' : `Incorrect — correct answer: ${current.options[current.correctIndex]}`}
          </p>
        </div>
      )}
      {answered && (
        <button
          type="button"
          onClick={() => void handleNext()}
          className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl"
        >
          {index < shuffledQuestions.length - 1 ? (
            <>
              Next question <ChevronRight className="w-4 h-4" />
            </>
          ) : (
            'Finish quiz'
          )}
        </button>
      )}
    </div>
  );
}
