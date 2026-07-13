import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Flame, Award, MessageSquare, Target, Sparkles, Brain } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { getAllConceptEngagements, subscribeConceptBus } from '../../lib/workspaceConceptBus';
import { loadAnnotations, type AnnotationCategory } from '../../lib/annotationStore';
import { loadQuizScore, type QuizScoreRecord } from '../../lib/quizStorage';
import { loadQuizIrt, buildQuizIrtDisplay, type QuizIrtState } from '../../lib/quizIrt';
import QuizIrtBadge from './QuizIrtBadge';
import { WORKSPACE_TOOLS } from '../../lib/workspaceToolRegistry';
import type { WorkspaceNoteBundle } from '../../lib/workspaceNoteContent';
import WorkspaceToolHeader from './WorkspaceToolHeader';

interface DashboardPanelProps {
  bundle: WorkspaceNoteBundle;
  progressKey: string;
  courseId: string;
}

const CATEGORY_COLORS: Record<AnnotationCategory, string> = {
  general: '#94a3b8',
  confusing: '#f59e0b',
  'exam-relevant': '#6366f1',
  important: '#ec4899',
  definition: '#10b981',
};

const CATEGORY_LABELS_EN: Record<AnnotationCategory, string> = {
  general: 'General',
  confusing: 'Confusing',
  'exam-relevant': 'Exam',
  important: 'Important',
  definition: 'Definition',
};

const CATEGORY_LABELS_EL: Record<AnnotationCategory, string> = {
  general: 'Γενικό',
  confusing: 'Μπερδεμένο',
  'exam-relevant': 'Εξέταση',
  important: 'Σημαντικό',
  definition: 'Ορισμός',
};

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  tone: 'indigo' | 'rose' | 'emerald' | 'amber';
}) {
  const toneClasses: Record<string, string> = {
    indigo: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    rose: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  };
  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-4 flex items-center gap-3 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${toneClasses[tone]}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-display font-bold text-slate-900 dark:text-white tracking-tight leading-none">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPanel({ bundle, progressKey, courseId }: DashboardPanelProps) {
  const { t } = useLanguage();
  const [busVersion, setBusVersion] = useState(0);
  const [quizScore, setQuizScore] = useState<QuizScoreRecord | null>(null);
  const [irtState, setIrtState] = useState<QuizIrtState | null>(null);

  useEffect(() => {
    const unsub = subscribeConceptBus(() => setBusVersion((v) => v + 1));
    return unsub;
  }, []);

  useEffect(() => {
    let active = true;
    loadQuizScore(courseId).then((rec) => { if (active) setQuizScore(rec); });
    loadQuizIrt(`${progressKey}-quiz`).then((state) => {
      if (active && state.responses > 0) setIrtState(state);
    });
    return () => { active = false; };
  }, [courseId, progressKey]);

  const engagements = useMemo(() => {
    void busVersion;
    return getAllConceptEngagements();
  }, [busVersion]);

  const mastered = engagements.filter((e) => e.struggleScore >= 0.5);
  const struggling = engagements.filter((e) => e.struggleScore <= -0.3);

  const topConcepts = useMemo(() => {
    return [...engagements]
      .sort((a, b) => Math.abs(b.struggleScore) - Math.abs(a.struggleScore))
      .slice(0, 8)
      .map((e) => ({
        name: e.concept.length > 18 ? `${e.concept.slice(0, 16)}…` : e.concept,
        score: Math.round(e.struggleScore * 100),
      }));
  }, [engagements]);

  const annotations = useMemo(() => loadAnnotations(progressKey), [progressKey, busVersion]);

  const annotationBreakdown = useMemo(() => {
    const counts = new Map<AnnotationCategory, number>();
    for (const a of annotations) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    return Array.from(counts.entries()).map(([category, count]) => ({
      category,
      count,
      label: t(CATEGORY_LABELS_EN[category], CATEGORY_LABELS_EL[category]),
      fill: CATEGORY_COLORS[category],
    }));
  }, [annotations, t]);

  const toolCoverage = useMemo(() => {
    const total = engagements.length || 1;
    return WORKSPACE_TOOLS.map((tool) => {
      const count = engagements.filter((e) => e.tools.includes(tool.id)).length;
      return { id: tool.id, label: tool.shortLabel, pct: Math.round((count / total) * 100), count };
    }).filter((c) => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [engagements]);

  const quizAccuracy = quizScore && quizScore.total > 0 ? Math.round((quizScore.correct / quizScore.total) * 100) : null;

  const hasAnyData = engagements.length > 0 || annotations.length > 0 || quizScore;

  return (
    <div className="flex flex-col h-full">
      <WorkspaceToolHeader toolId="dashboard" />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {!hasAnyData ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-base font-display font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
              {t('No Progress Data Yet', 'Δεν υπάρχουν δεδομένα προόδου ακόμα')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
              {t(
                'Study with other tools — flashcards, quizzes, reader annotations — and your progress will show up here.',
                'Μελέτησε με τα άλλα εργαλεία — κάρτες, κουίζ, σημειώσεις αναγνώστη — και η πρόοδός σου θα εμφανιστεί εδώ.',
              )}
            </p>
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={Target} label={t('Concepts Tracked', 'Έννοιες υπό παρακολούθηση')} value={String(engagements.length)} tone="indigo" />
              <StatCard icon={Award} label={t('Mastered', 'Κατακτημένα')} value={String(mastered.length)} tone="emerald" />
              <StatCard icon={Flame} label={t('Struggling', 'Δυσκολεύεσαι')} value={String(struggling.length)} tone="rose" />
              <StatCard
                icon={quizAccuracy != null && quizAccuracy >= 70 ? TrendingUp : TrendingDown}
                label={t('Quiz Accuracy', 'Ακρίβεια Κουίζ')}
                value={quizAccuracy != null ? `${quizAccuracy}%` : '—'}
                tone={quizAccuracy != null && quizAccuracy >= 70 ? 'emerald' : 'amber'}
              />
            </div>

            {/* IRT Readiness card */}
            {irtState && (
              <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <h4 className="text-sm font-display font-bold text-slate-900 dark:text-white mb-1 tracking-tight flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-indigo-500" />
                  {t('Quiz IRT Readiness', 'Ετοιμότητα IRT Κουίζ')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  {t(
                    `${irtState.responses} responses · ${irtState.correct} correct · ability θ = ${irtState.ability.toFixed(2)}`,
                    `${irtState.responses} απαντήσεις · ${irtState.correct} σωστές · ικανότητα θ = ${irtState.ability.toFixed(2)}`,
                  )}
                </p>
                <QuizIrtBadge
                  irt={buildQuizIrtDisplay(4, irtState.ability)}
                  responseCount={irtState.responses}
                />
              </div>
            )}

            {/* Concept mastery chart */}
            {topConcepts.length > 0 && (
              <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <h4 className="text-sm font-display font-bold text-slate-900 dark:text-white mb-1 tracking-tight">
                  {t('Concept Mastery', 'Κατάκτηση Εννοιών')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  {t('Struggle (red) vs. mastery (green) score per concept', 'Βαθμός δυσκολίας (κόκκινο) έναντι κατάκτησης (πράσινο) ανά έννοια')}
                </p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topConcepts} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid stroke="#334155" strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                      <XAxis type="number" domain={[-100, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 12 }}
                      />
                      <Bar dataKey="score" radius={[4, 4, 4, 4]}>
                        {topConcepts.map((c, i) => (
                          <Cell key={i} fill={c.score >= 0 ? '#10b981' : '#f43f5e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Annotation breakdown */}
              {annotationBreakdown.length > 0 && (
                <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <h4 className="text-sm font-display font-bold text-slate-900 dark:text-white mb-1 tracking-tight flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                    {t('Annotations', 'Σημειώσεις')}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{annotations.length} {t('total', 'σύνολο')}</p>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={annotationBreakdown} dataKey="count" nameKey="label" innerRadius={35} outerRadius={60} paddingAngle={2}>
                          {annotationBreakdown.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {annotationBreakdown.map((entry) => (
                      <span key={entry.category} className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                        {entry.label} ({entry.count})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tool coverage */}
              {toolCoverage.length > 0 && (
                <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <h4 className="text-sm font-display font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
                    {t('Tool Engagement', 'Χρήση Εργαλείων')}
                  </h4>
                  <div className="space-y-2.5">
                    {toolCoverage.map((tc) => (
                      <div key={tc.id}>
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">
                          <span>{tc.label}</span>
                          <span>{tc.count}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${tc.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Source intelligence recap */}
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-display font-bold text-slate-900 dark:text-white tracking-tight">
                  {t('Source Quality', 'Ποιότητα Πηγής')}
                </h4>
                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                  bundle.sourceIntelligence.band === 'strong'
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                    : bundle.sourceIntelligence.band === 'moderate'
                    ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                }`}>
                  {bundle.sourceIntelligence.band} · {bundle.sourceIntelligence.score}%
                </span>
              </div>
              {bundle.sourceIntelligence.strengths.length > 0 && (
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  {bundle.sourceIntelligence.strengths.slice(0, 4).map((s) => (
                    <li key={s} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 flex-shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
