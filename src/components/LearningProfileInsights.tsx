import { BrainCircuit, Gauge, TriangleAlert } from "lucide-react";
import { useLearningProfileStore } from "../store/useLearningProfileStore";

export default function LearningProfileInsights() {
  const profile = useLearningProfileStore((state) => state.profile);
  const topErrors = Object.entries(profile.errorPatterns)
    .sort(([, left], [, right]) => right.count - left.count)
    .slice(0, 3);

  return (
    <section className="h-full rounded-xl border border-violet-200/70 bg-white p-5 shadow-sm dark:border-violet-900/70 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-violet-50 p-2 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300">
          <BrainCircuit className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Adaptive Evidence
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Local behavioral outcomes—not a “learning style”
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            Confidence
          </div>
          <p className="mt-1 font-bold text-slate-900 dark:text-white">
            {Math.round(profile.parameters.confidence * 100)}%
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Retrieval evidence
          </p>
          <p className="mt-1 font-bold text-slate-900 dark:text-white">
            {Math.round(profile.stats.retrievalSuccess.mean * 100)}%
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          Recurring error patterns
        </p>
        {topErrors.length > 0 ? (
          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
            {topErrors.map(([label, pattern]) => (
              <li key={label} className="flex items-center justify-between gap-3">
                <span className="truncate">{label.replaceAll(":", " · ")}</span>
                <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                  {pattern.count}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            No stable pattern yet. Personalization remains near the population
            prior until repeated outcomes accumulate.
          </p>
        )}
      </div>
    </section>
  );
}
