import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, BookOpen, Sparkles, Users, Building2,
  ArrowRight, ArrowLeft, Upload, Target, Brain,
  Calendar, Clock, AlertCircle, Zap, CheckCircle2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';
import { getOnboardingContent } from '../lib/onboardingContent';
import {
  type OnboardingGoalId,
  type OnboardingRoleId,
  type OnboardingValidationError,
  type OnboardingWizardStep,
  validateOnboardingStep,
  loadOnboardingDraft,
  saveOnboardingDraft,
  isResumedDraft,
  clearOnboardingDraft,
  saveOnboardingProfile,
} from '../lib/onboardingProfile';
import { useStore } from '../store/useStore';

// ── Props ──────────────────────────────────────────────────────────

interface OnboardingProps {
  onComplete: (data: {
    role?: string;
    goals?: string[];
    dailyGoalMinutes?: number;
    examDate?: string;
    displayName?: string;
    skipWizard?: boolean;
  }) => void;
}

const STEP_ORDER: OnboardingWizardStep[] = ['welcome', 'role', 'goals', 'schedule'];

const ROLE_ICONS: Record<OnboardingRoleId, typeof GraduationCap> = {
  university: GraduationCap,
  highschool: BookOpen,
  selflearner: Sparkles,
  tutor: Users,
  professional: Building2,
};

const FEATURE_ICONS = [Upload, Brain, Target, Zap];

function validationMessage(error: OnboardingValidationError, content: ReturnType<typeof getOnboardingContent>): string {
  switch (error) {
    case 'roleRequired': return content.validationRoleRequired;
    case 'goalRequired': return content.validationGoalRequired;
    case 'examDateRequired': return content.validationExamDateRequired;
    case 'examDatePast': return content.validationExamDatePast;
    default: return '';
  }
}

// ── Main Component ─────────────────────────────────────────────────

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { language } = useLanguage();
  const content = getOnboardingContent(language);
  const setDailyGoal = useStore((s) => s.setDailyGoal);

  const [step, setStep] = useState<OnboardingWizardStep>('welcome');
  const [selectedRole, setSelectedRole] = useState<OnboardingRoleId | null>(null);
  const [selectedGoals, setSelectedGoals] = useState<OnboardingGoalId[]>([]);
  const [dailyTime, setDailyTime] = useState(30);
  const [examDate, setExamDate] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showResumeHint, setShowResumeHint] = useState(false);
  const [validationError, setValidationError] = useState<OnboardingValidationError | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  // Load draft on mount
  useEffect(() => {
    loadOnboardingDraft().then((draft) => {
      if (draft) {
        setStep(draft.step);
        setSelectedRole(draft.selectedRole);
        setSelectedGoals(draft.selectedGoals);
        setDailyTime(draft.dailyTime);
        setExamDate(draft.examDate);
        setDisplayName(draft.displayName);
        if (isResumedDraft(draft)) setShowResumeHint(true);
      }
      setDraftLoaded(true);
    });
  }, []);

  // Save draft on change
  useEffect(() => {
    if (!draftLoaded) return;
    void saveOnboardingDraft({
      step,
      selectedRole,
      selectedGoals,
      dailyTime,
      examDate,
      displayName,
      savedAt: '',
    });
  }, [step, selectedRole, selectedGoals, dailyTime, examDate, displayName, draftLoaded]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const progress = ((stepIndex + 1) / STEP_ORDER.length) * 100;

  const clearValidation = () => {
    if (validationError) setValidationError(null);
  };

  const showValidationError = (error: OnboardingValidationError) => {
    setValidationError(error);
    window.requestAnimationFrame(() => errorRef.current?.focus());
  };

  const next = () => {
    const error = validateOnboardingStep(step, {
      role: selectedRole,
      goals: selectedGoals,
      examDate,
    });
    if (error) {
      showValidationError(error);
      return;
    }
    clearValidation();
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  };

  const prev = () => {
    clearValidation();
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  };

  const toggleGoal = (id: OnboardingGoalId) => {
    clearValidation();
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const hasExamGoal = selectedGoals.includes('exam');

  const formattedExamDate = useMemo(() => {
    if (!examDate) return '—';
    return new Date(examDate).toLocaleDateString(language === 'el' ? 'el-GR' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, [examDate, language]);

  const completeOnboarding = async (opts?: { skipWizard?: boolean }) => {
    if (!opts?.skipWizard && step === 'schedule') {
      const error = validateOnboardingStep('schedule', {
        role: selectedRole,
        goals: selectedGoals,
        examDate,
      });
      if (error) {
        showValidationError(error);
        return;
      }
    }
    clearValidation();

    // Persist profile
    await saveOnboardingProfile({
      completed: true,
      role: selectedRole,
      goals: selectedGoals,
      dailyGoalMinutes: dailyTime,
      examDate,
      displayName: displayName.trim(),
      completedAt: new Date().toISOString(),
    });
    await clearOnboardingDraft();

    // Apply settings to store
    setDailyGoal(dailyTime);

    onComplete({
      role: selectedRole ?? undefined,
      goals: selectedGoals,
      dailyGoalMinutes: dailyTime,
      examDate: examDate || undefined,
      displayName: displayName.trim() || undefined,
      skipWizard: opts?.skipWizard,
    });
  };

  const validationText = validationError ? validationMessage(validationError, content) : null;

  if (!draftLoaded) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={STEP_ORDER.length}>
        <div
          className="h-1 bg-indigo-600 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {showResumeHint && (
            <p className="mb-4 text-center text-xs text-indigo-500 dark:text-indigo-400 font-medium">
              {content.resumeDraftHint}
            </p>
          )}

          {validationText && (
            <div
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 outline-none focus:ring-2 focus:ring-rose-400/50"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {validationText}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ── Welcome ─────────────────────────────────────── */}
            {step === 'welcome' && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shadow-sm">
                  <Sparkles className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-center space-y-3">
                  <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                    {content.welcomeTitle}
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                    {content.welcomeBody}
                  </p>
                </div>

                <div>
                  <p className="section-eyebrow uppercase mb-4 text-center">
                    {content.welcomeFeatureTitle}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {content.features.map((feature, index) => {
                      const Icon = FEATURE_ICONS[index] ?? Zap;
                      return (
                        <div
                          key={feature.title}
                          className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-4 text-left shadow-sm"
                        >
                          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-3">
                            <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{feature.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{feature.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="max-w-sm mx-auto space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5" htmlFor="onb-name">
                      {content.nameLabel}{' '}
                      <span className="text-slate-400 dark:text-slate-500">{content.nameOptional}</span>
                    </label>
                    <input
                      id="onb-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={content.namePlaceholder}
                      autoComplete="name"
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-600 transition-colors"
                    />
                  </div>
                  <button
                    onClick={next}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {content.continueButton} <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => void completeOnboarding({ skipWizard: true })}
                    className="w-full text-center text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium"
                  >
                    {content.skipButton}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Role ────────────────────────────────────────── */}
            {step === 'role' && (
              <motion.div
                key="role"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                    {content.roleTitle}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{content.roleSubtitle}</p>
                </div>

                <div className="space-y-2">
                  {content.roles.map((role) => {
                    const Icon = ROLE_ICONS[role.id] ?? GraduationCap;
                    const isSelected = selectedRole === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => { clearValidation(); setSelectedRole(role.id); }}
                        className={cn(
                          'w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left',
                          isSelected
                            ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-300 dark:ring-indigo-700 shadow-sm'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700',
                        )}
                      >
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                          isSelected
                            ? 'bg-indigo-100 dark:bg-indigo-800/40 text-indigo-600 dark:text-indigo-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
                        )}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{role.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{role.description}</p>
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={prev}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> {content.backButton}
                  </button>
                  <button
                    onClick={next}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-sm"
                  >
                    {content.continueButton} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Goals ───────────────────────────────────────── */}
            {step === 'goals' && (
              <motion.div
                key="goals"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                    {content.goalsTitle}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{content.goalsSubtitle}</p>
                </div>

                <div className="space-y-2">
                  {content.goals.map((goal) => {
                    const isSelected = selectedGoals.includes(goal.id);
                    return (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => toggleGoal(goal.id)}
                        className={cn(
                          'w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left',
                          isSelected
                            ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-300 dark:ring-indigo-700 shadow-sm'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700',
                        )}
                      >
                        <div className={cn(
                          'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500 text-white'
                            : 'border-slate-300 dark:border-slate-600',
                        )}>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{goal.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{goal.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={prev}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> {content.backButton}
                  </button>
                  <button
                    onClick={next}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-sm"
                  >
                    {content.continueButton} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Schedule ────────────────────────────────────── */}
            {step === 'schedule' && (
              <motion.div
                key="schedule"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                    {content.scheduleTitle}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{content.scheduleSubtitle}</p>
                </div>

                {/* Daily goal slider */}
                <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{content.dailyGoalLabel}</p>
                      <p className="text-2xl font-display font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                        {dailyTime} <span className="text-sm font-medium text-slate-400">{content.dailyGoalUnit}</span>
                      </p>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={120}
                    step={5}
                    value={dailyTime}
                    onChange={(e) => setDailyTime(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1 tabular-nums">
                    <span>10</span>
                    <span>30</span>
                    <span>60</span>
                    <span>90</span>
                    <span>120</span>
                  </div>
                </div>

                {/* Exam date (conditional) */}
                {hasExamGoal && (
                  <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{content.examDateLabel}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{content.examDateHint}</p>
                      </div>
                    </div>
                    <input
                      type="date"
                      value={examDate}
                      onChange={(e) => { clearValidation(); setExamDate(e.target.value); }}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-400"
                    />
                    {examDate && (
                      <p className="text-xs text-slate-500 mt-2 font-medium">{formattedExamDate}</p>
                    )}
                  </div>
                )}

                {/* Summary recap */}
                <div className="rounded-xl border border-indigo-200/60 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-900/10 p-4">
                  <p className="section-eyebrow uppercase mb-3 text-indigo-500 dark:text-indigo-400">
                    {language === 'el' ? 'Ανακεφαλαίωση' : 'Summary'}
                  </p>
                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    {displayName && <p>👤 {displayName}</p>}
                    {selectedRole && (
                      <p>🎓 {content.roles.find((r) => r.id === selectedRole)?.label}</p>
                    )}
                    <p>🎯 {selectedGoals.map((g) => content.goals.find((goal) => goal.id === g)?.label).join(', ')}</p>
                    <p>⏱️ {dailyTime} {content.dailyGoalUnit}/{language === 'el' ? 'ημέρα' : 'day'}</p>
                    {hasExamGoal && examDate && <p>📅 {formattedExamDate}</p>}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={prev}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> {content.backButton}
                  </button>
                  <button
                    onClick={() => void completeOnboarding()}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <Sparkles className="w-4 h-4" /> {content.finishButton}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
