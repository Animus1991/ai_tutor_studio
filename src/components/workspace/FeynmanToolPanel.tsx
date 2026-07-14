import { useState } from 'react';
import { Loader2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { feynmanCheck, checkHealth } from '../../lib/api';
import { useMasteryStore } from '../../store/useMasteryStore';
import { logActivity } from '../../lib/activity';
import { toast } from 'sonner';

type FeynmanFeedback = {
  praise: string;
  gaps: string[];
};

type Props = {
  sourceText: string;
  concept: string;
  steps: string[];
  suggestedGaps: string[];
  courseTitle?: string;
};

function offlineFeynmanCheck(
  explanation: string,
  suggestedGaps: string[],
): FeynmanFeedback {
  const lower = explanation.toLowerCase();
  const wordCount = explanation.trim().split(/\s+/).filter(Boolean).length;
  const missed = suggestedGaps.filter((gap) => {
    const keyword = gap.split(/\s+/).find((w) => w.length > 4)?.toLowerCase();
    return keyword ? !lower.includes(keyword) : !lower.includes(gap.toLowerCase().slice(0, 12));
  });

  const praise =
    wordCount >= 40
      ? 'Solid effort — you covered several core ideas in your own words.'
      : 'Good start — try expanding with more detail and examples.';

  return { praise, gaps: missed.length > 0 ? missed.slice(0, 5) : [] };
}

export default function FeynmanToolPanel({
  sourceText,
  concept,
  steps,
  suggestedGaps,
  courseTitle,
}: Props) {
  const [explanation, setExplanation] = useState('');
  const [feedback, setFeedback] = useState<FeynmanFeedback | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const updateFeynmanScore = useMasteryStore((s) => s.updateFeynmanScore);

  const handleCheck = async () => {
    if (!explanation.trim()) return;
    setIsChecking(true);
    setFeedback(null);

    try {
      let result: FeynmanFeedback;
      const serverUp = await checkHealth();

      if (serverUp) {
        try {
          result = await feynmanCheck(sourceText.slice(0, 12_000), explanation);
        } catch {
          result = offlineFeynmanCheck(explanation, suggestedGaps);
          toast.info('AI unavailable — using offline gap analysis');
        }
      } else {
        result = offlineFeynmanCheck(explanation, suggestedGaps);
        toast.info('Offline mode — comparing against course outline');
      }

      setFeedback(result);
      const score = Math.max(1, 10 - (result.gaps?.length ?? 0) * 2);
      updateFeynmanScore(score);
      logActivity(
        `Feynman check: ${courseTitle ?? concept} (${result.gaps.length} gaps)`,
        'study',
      );
    } catch (e) {
      console.error(e);
      toast.error('Failed to evaluate explanation');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="p-4 space-y-4 overflow-auto max-h-full">
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Concept</p>
        <p className="text-sm font-bold text-slate-900 dark:text-white">{concept}</p>
      </div>

      {steps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">Explain in this order</p>
          <ol className="list-decimal list-inside text-sm space-y-1.5 text-slate-700 dark:text-slate-300">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {suggestedGaps.length > 0 && !feedback && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-3">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
            Knowledge gaps to address
          </p>
          {suggestedGaps.map((g, i) => (
            <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
              • {g}
            </p>
          ))}
        </div>
      )}

      <div>
        <label htmlFor="feynman-explanation" className="text-xs font-semibold text-slate-500 mb-2 block">
          Your explanation
        </label>
        <textarea
          id="feynman-explanation"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Explain the concept in your own words, as if teaching a friend..."
          className="w-full h-32 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>

      <button
        type="button"
        onClick={handleCheck}
        disabled={isChecking || !explanation.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {isChecking ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Checking...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" /> Check with Feynman AI
          </>
        )}
      </button>

      {feedback && (
        <div className="space-y-3">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-3 flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200">{feedback.praise}</p>
          </div>
          {feedback.gaps.length > 0 ? (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                  Gaps to review ({feedback.gaps.length})
                </p>
              </div>
              <ul className="space-y-1">
                {feedback.gaps.map((g, i) => (
                  <li key={i} className="text-xs text-rose-700 dark:text-rose-300">
                    • {g}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium text-center">
              No critical gaps detected — excellent mastery!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
