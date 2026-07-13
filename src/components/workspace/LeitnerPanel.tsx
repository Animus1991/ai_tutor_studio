import { useState, useMemo, useCallback } from 'react';
import { RotateCcw, ThumbsUp, ThumbsDown, Shuffle, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { noteConceptActivity } from '../../lib/workspaceConceptBus';
import type { Flashcard } from '../../lib/noteContentExtractors';
import WorkspaceToolHeader from './WorkspaceToolHeader';

interface LeitnerPanelProps {
  flashcards: Flashcard[];
  courseId?: string;
}

type Rating = 'easy' | 'good' | 'hard' | 'again';

interface CardState {
  index: number;
  revealed: boolean;
  box: number; // 1-5 Leitner box
  lastRating?: Rating;
  nextReview?: number;
}

export default function LeitnerPanel({ flashcards, courseId }: LeitnerPanelProps) {
  const { t } = useLanguage();
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [ratings, setRatings] = useState<Map<number, { box: number; rating: Rating }>>(new Map());

  const cards = useMemo(() => {
    if (!shuffled) return flashcards;
    return [...flashcards].sort(() => Math.random() - 0.5);
  }, [flashcards, shuffled]);

  const currentCard = cards[cardIndex];
  const progress = cards.length > 0 ? ((cardIndex + 1) / cards.length) * 100 : 0;

  const handleRate = useCallback((rating: Rating) => {
    if (!currentCard) return;

    const prev = ratings.get(cardIndex);
    const currentBox = prev?.box ?? 1;
    let newBox = currentBox;

    if (rating === 'easy') newBox = Math.min(5, currentBox + 2);
    else if (rating === 'good') newBox = Math.min(5, currentBox + 1);
    else if (rating === 'hard') newBox = currentBox;
    else newBox = 1; // 'again' → back to box 1

    setRatings((m) => new Map(m).set(cardIndex, { box: newBox, rating }));

    // Emit to concept bus
    const signal = rating === 'easy' || rating === 'good' ? 'leitner-easy' : 'leitner-hard';
    noteConceptActivity(currentCard.front.slice(0, 40), 'leitner', signal);

    // Auto-advance
    setRevealed(false);
    if (cardIndex < cards.length - 1) {
      setCardIndex(cardIndex + 1);
    }
  }, [currentCard, cardIndex, cards.length, ratings]);

  const boxCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const [, { box }] of ratings) counts[box - 1]++;
    return counts;
  }, [ratings]);

  if (cards.length === 0) return null;

  return (
    <div className="flex flex-col h-full">
      <WorkspaceToolHeader toolId="leitner">
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setShuffled(!shuffled); setCardIndex(0); setRevealed(false); }}
            title={t('Shuffle', 'Ανακάτεμα')}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
        </div>
      </WorkspaceToolHeader>

      {/* Progress bar */}
      <div className="px-5 py-3">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <span className="font-medium">{cardIndex + 1} / {cards.length}</span>
          <span className="font-medium">{ratings.size} {t('rated', 'αξιολογήθηκαν')}</span>
        </div>
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Leitner boxes indicator */}
      <div className="px-5 pb-3 flex gap-1">
        {boxCounts.map((count, i) => (
          <div key={i} className="flex-1 text-center">
            <div className={`h-1.5 rounded-full ${count > 0 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <span className="text-xs text-slate-400 font-medium">{i + 1}</span>
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="flex-1 px-5 pb-5 flex flex-col">
        <div
          onClick={() => setRevealed(!revealed)}
          className="flex-1 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-8 flex flex-col items-center justify-center cursor-pointer card-hover group relative overflow-hidden shadow-sm"
        >
          {/* Box indicator */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <div className="w-5 h-5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span>{t('Box', 'Κουτί')} {ratings.get(cardIndex)?.box ?? 1}</span>
          </div>

          <div className="text-center max-w-md">
            {!revealed ? (
              <>
                <p className="text-lg font-display font-bold text-slate-900 dark:text-white leading-relaxed tracking-tight">
                  {currentCard?.front}
                </p>
                <p className="text-xs text-slate-400 mt-5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors font-medium">
                  {t('Tap to reveal answer', 'Πάτα για αποκάλυψη')}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-3 font-display tracking-tight">{t('Answer', 'Απάντηση')}</p>
                <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                  {currentCard?.back}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Rating buttons */}
        {revealed && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => handleRate('again')}
              className="flex-1 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all duration-200 flex items-center justify-center gap-1.5 border border-rose-200 dark:border-rose-800/50 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {t('Again', 'Ξανά')}
            </button>
            <button
              onClick={() => handleRate('hard')}
              className="flex-1 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all duration-200 flex items-center justify-center gap-1.5 border border-amber-200 dark:border-amber-800/50 shadow-sm"
            >
              <ThumbsDown className="w-3.5 h-3.5" /> {t('Hard', 'Δύσκολο')}
            </button>
            <button
              onClick={() => handleRate('good')}
              className="flex-1 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all duration-200 flex items-center justify-center gap-1.5 border border-blue-200 dark:border-blue-800/50 shadow-sm"
            >
              <ThumbsUp className="w-3.5 h-3.5" /> {t('Good', 'Καλό')}
            </button>
            <button
              onClick={() => handleRate('easy')}
              className="flex-1 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all duration-200 flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-800/50 shadow-sm"
            >
              <ThumbsUp className="w-3.5 h-3.5" /> {t('Easy', 'Εύκολο')}
            </button>
          </div>
        )}

        {/* Navigation */}
        {!revealed && (
          <div className="flex justify-between mt-4">
            <button
              onClick={() => { setCardIndex(Math.max(0, cardIndex - 1)); setRevealed(false); }}
              disabled={cardIndex === 0}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setCardIndex(Math.min(cards.length - 1, cardIndex + 1)); setRevealed(false); }}
              disabled={cardIndex >= cards.length - 1}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
