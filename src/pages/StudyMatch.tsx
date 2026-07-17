import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Timer,
  Shield,
  Sparkles,
  BookOpen,
  Loader2,
  GraduationCap,
  Users,
  Target,
  HeartHandshake,
  Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../store/useAuthStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useLanguage } from '../lib/i18n';
import { isDemoModeActive } from '../lib/demoStorage';
import CommunityGuidelinesModal from '../components/CommunityGuidelinesModal';
import {
  hasAcceptedCommunityGuidelines,
} from '../lib/safeSocial';
import { parseMatchBridgeQuery } from '../lib/socialPolicy';
import { heuristicModerateText } from '../../server/matchModeratorHeuristics';
import {
  MATCH_DURATIONS,
  STUDY_ENERGIES,
  STUDY_VIBES,
  type MatchDuration,
  type MatchFlexibility,
  type StudyEnergy,
  type StudyVibe,
  buddyDisplayName,
  canonicalTopicKey,
  emailDomain,
  enqueueMatch,
  getMatchStatus,
  isValidDomainFilter,
  leaveMatchQueue,
} from '../lib/studyMatch';

type Phase = 'form' | 'waiting';

const VIBE_LABELS: Record<StudyVibe, { en: string; el: string }> = {
  quiet: { en: 'Quiet focus', el: 'Ήσυχη συγκέντρωση' },
  balanced: { en: 'Soft check-ins', el: 'Ήπια check-ins' },
  chatty: { en: 'Explain & trade', el: 'Εξήγηση & ανταλλαγή' },
};

const ENERGY_LABELS: Record<StudyEnergy, { en: string; el: string }> = {
  focused: { en: 'Sprint', el: 'Sprint' },
  steady: { en: 'Steady', el: 'Σταθερή' },
  low_energy: { en: 'Calm', el: 'Ήρεμη' },
};

export default function StudyMatch() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const courses = useLibraryStore((s) => s.courses);
  const hydrate = useLibraryStore((s) => s.hydrate);

  const bridge = useMemo(
    () => parseMatchBridgeQuery(searchParams.toString()),
    [searchParams],
  );

  const demo = isDemoMode || isDemoModeActive();
  const [showGuidelines, setShowGuidelines] = useState(() => !hasAcceptedCommunityGuidelines());
  const [topic, setTopic] = useState(() => bridge.topic);
  const [duration, setDuration] = useState<MatchDuration>(25);
  const [domainFilter, setDomainFilter] = useState('');
  const [flexibility, setFlexibility] = useState<MatchFlexibility>('prefer_topic');
  const [vibe, setVibe] = useState<StudyVibe>('balanced');
  const [energy, setEnergy] = useState<StudyEnergy>('steady');
  const [sessionGoal, setSessionGoal] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [busy, setBusy] = useState(false);
  const [queuedAt, setQueuedAt] = useState<string | null>(null);
  const [waitSecs, setWaitSecs] = useState(0);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (bridge.topic) setTopic(bridge.topic);
  }, [bridge.topic]);

  const suggestions = useMemo(() => {
    const fromCourses = courses.map((c) => c.title).filter(Boolean).slice(0, 12);
    const defaults = ['Organic Chemistry', 'Calculus', 'Linear Algebra', 'Biology', 'History'];
    return Array.from(new Set([...fromCourses, ...defaults])).slice(0, 16);
  }, [courses]);

  const userDomain = user?.email ? emailDomain(user.email) : '';

  const pollStatus = useCallback(async () => {
    if (demo) return;
    try {
      const status = await getMatchStatus();
      if (status.status === 'matched') {
        navigate(`/match/${status.session.id}`, { replace: true });
        return;
      }
      if (status.status === 'waiting') {
        setPhase('waiting');
        setTopic(status.topicLabel);
        setDuration(status.durationMin);
        setQueuedAt(status.queuedAt);
      } else if (status.status === 'idle' && phase === 'waiting') {
        setPhase('form');
        setQueuedAt(null);
        toast.info(t('Queue expired — try again', 'Η αναμονή έληξε — δοκίμασε ξανά'));
      }
    } catch {
      /* ignore transient */
    }
  }, [demo, navigate, phase, t]);

  useEffect(() => {
    if (demo || showGuidelines) return;
    void pollStatus();
    const id = window.setInterval(() => void pollStatus(), 2500);
    return () => window.clearInterval(id);
  }, [demo, showGuidelines, pollStatus]);

  useEffect(() => {
    if (phase !== 'waiting') return;
    const id = window.setInterval(() => setWaitSecs((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const startDemoMatch = () => {
    const label = topic.trim() || (flexibility === 'any_study' ? 'General study' : 'Organic Chemistry');
    const id = `demo-ms-${Date.now()}`;
    const now = Date.now();
    const endsAt = new Date(now + duration * 60_000).toISOString();
    const peerName = buddyDisplayName('demo-peer');
    const topicMatched = Boolean(topic.trim()) && flexibility !== 'any_study';
    const goal = sessionGoal.trim();
    const session = {
      id,
      topicLabel: topicMatched ? label : topic.trim() ? `${label} + Mixed study` : 'General study',
      topicKey: topicMatched ? canonicalTopicKey(label) : 'mixed-study',
      topicMatched,
      durationMin: duration,
      roomId: `match-${id}`.slice(0, 64),
      status: 'active' as const,
      startedAt: new Date(now).toISOString(),
      endsAt,
      notes: `# Focus block\n\n- Shared scratchpad (demo)\n- AI moderator on · no stranger DMs after\n`,
      messages: [
        {
          id: 'sys1',
          userId: 'system',
          displayName: 'Memora',
          text: topicMatched
            ? `Focus Pomodoro: ${label} · ${duration}′. Same topic. Camera off. AI safety moderator is on.`
            : `Focus Pomodoro · ${duration}′. Study buddies (topic optional). Camera off. AI safety moderator is on.`,
          createdAt: new Date(now).toISOString(),
        },
        ...(goal
          ? [
              {
                id: 'sys-goal',
                userId: 'system',
                displayName: 'Memora',
                text: `Session intention: ${goal}`,
                createdAt: new Date(now + 200).toISOString(),
              },
            ]
          : []),
        {
          id: 'peer1',
          userId: 'demo-peer',
          displayName: peerName,
          text: t(
            "Hey — ready to focus. Soft check-in at the halfway mark?",
            'Γεια — έτοιμος/η για focus. Ήπιο check-in στη μέση;',
          ),
          createdAt: new Date(now + 800).toISOString(),
          reactions: {},
        },
      ],
      meetConsent: { demo: false, peer: false },
      meetUrl: null,
      selfId: 'demo',
      peerId: 'demo-peer',
      peerDisplayName: peerName,
      domainFilter: '',
      pomodoro: {
        phase: 'focus' as const,
        cycle: 1,
        phaseStartedAt: new Date(now).toISOString(),
        phaseEndsAt: endsAt,
        focusMin: duration,
        breakMin: 5,
      },
      peerOnline: true,
      selfOnline: true,
      sessionGoal: goal,
      selfVibe: vibe,
      peerVibe: vibe === 'quiet' ? 'quiet' : 'balanced',
      selfEnergy: energy,
      peerEnergy: 'steady' as const,
      respectVoted: false,
    };
    sessionStorage.setItem(`memora-demo-match:${id}`, JSON.stringify(session));
    toast.success(t('Matched with a demo study buddy', 'Match με demo study buddy'));
    navigate(`/match/${id}`);
  };

  const handleFind = async () => {
    if (!hasAcceptedCommunityGuidelines()) {
      setShowGuidelines(true);
      return;
    }
    const label = topic.trim();
    if (flexibility === 'prefer_topic' && label.length < 2) {
      toast.error(
        t(
          'Enter a subject, or switch to “Any study buddy”',
          'Βάλε μάθημα, ή διάλεξε «Οποιοσδήποτε study buddy»',
        ),
      );
      return;
    }
    if (sessionGoal.trim()) {
      const mod = heuristicModerateText(sessionGoal);
      if (!mod.allowed) {
        toast.error(mod.reason);
        return;
      }
    }
    if (demo) {
      setPhase('waiting');
      setQueuedAt(new Date().toISOString());
      setWaitSecs(0);
      window.setTimeout(() => startDemoMatch(), 1800);
      return;
    }
    if (!user?.email) {
      toast.error(t('Sign in with Google to match', 'Συνδέσου με Google για match'));
      return;
    }
    if (domainFilter && !isValidDomainFilter(domainFilter, user.email)) {
      toast.error(
        t(
          `Domain filter must match your email (@${userDomain})`,
          `Το φίλτρο domain πρέπει να ταιριάζει με το email σου (@${userDomain})`,
        ),
      );
      return;
    }

    setBusy(true);
    try {
      const result = await enqueueMatch({
        topicLabel: label,
        durationMin: duration,
        domainFilter: domainFilter || undefined,
        guidelinesAccepted: hasAcceptedCommunityGuidelines(),
        flexibility,
        vibe,
        energy,
        sessionGoal: sessionGoal.trim(),
      });
      if (result.status === 'matched') {
        navigate(`/match/${result.session.id}`, { replace: true });
        return;
      }
      setPhase('waiting');
      setQueuedAt(result.queuedAt);
      setWaitSecs(0);
      toast.message(t('Looking for a study buddy…', 'Αναζήτηση study buddy…'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Match failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (demo) {
      setPhase('form');
      setQueuedAt(null);
      return;
    }
    try {
      await leaveMatchQueue();
    } catch {
      /* ignore */
    }
    setPhase('form');
    setQueuedAt(null);
  };

  const waitLabel = topic.trim() || t('Any study', 'Οποιοδήποτε διάβασμα');

  return (
    <div className="max-w-3xl mx-auto space-y-5" data-testid="study-match-page">
      <header className="ux-page-header">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" />
            {t('Study Match', 'Study Match')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'Time-boxed focus with a study buddy — same topic preferred, not required. No public profiles, no stranger DMs after.',
              'Χρονισμένη συγκέντρωση με study buddy — ίδιο θέμα προτιμητέο, όχι υποχρεωτικό. Χωρίς δημόσια προφίλ, χωρίς DM μετά.',
            )}
          </p>
        </div>
      </header>

      {bridge.fromCircle && (
        <div className="rounded-2xl border border-indigo-200/70 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/20 px-3.5 py-2.5 text-sm text-indigo-900 dark:text-indigo-200">
          {t(
            'Opened from a Study Circle — same safety envelope (guidelines, dual Meet consent, report & leave).',
            'Άνοιξε από Study Circle — ίδιο πλαίσιο ασφαλείας (guidelines, διπλή συναίνεση Meet, αναφορά & έξοδος).',
          )}
        </div>
      )}

      <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5 flex gap-3 text-sm text-emerald-900 dark:text-emerald-200">
        <Shield className="w-5 h-5 shrink-0 mt-0.5" />
        <ul className="space-y-1 list-disc pl-4">
          <li>{t('Verified Google email + guidelines before join', 'Επαληθευμένο Google email + guidelines πριν μπεις')}</li>
          <li>{t('Camera off by default — chat, notes, whiteboard', 'Κάμερα off — chat, σημειώσεις, whiteboard')}</li>
          <li>{t('Meet only if both opt in · Instant report & leave', 'Meet μόνο με διπλή συναίνεση · Άμεση αναφορά & έξοδος')}</li>
          <li className="inline-flex items-start gap-1.5">
            <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {t(
              'AI moderator blocks nude / sexual content & talk',
              'AI moderator απορρίπτει γυμνό / σεξουαλικό υλικό & συζητήσεις',
            )}
          </li>
        </ul>
      </div>

      {phase === 'waiting' ? (
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 text-center space-y-4 shadow-sm">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/30">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <div>
            <p className="text-lg font-display font-bold text-slate-900 dark:text-white">
              {t('Finding a focus buddy…', 'Βρίσκουμε focus buddy…')}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {waitLabel} · {duration} {t('min', 'λεπτά')}
              {queuedAt ? ` · ${waitSecs}s` : ''}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              {flexibility === 'any_study'
                ? t('Open to any study buddy on this timer', 'Ανοιχτό σε οποιονδήποτε study buddy σε αυτό το timer')
                : t('Preferring same topic · may still match nearby vibes', 'Προτίμηση ίδιου θέματος · μπορεί να γίνει και εύκαμπτο match')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleCancel()}
            className="min-h-11 px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold"
          >
            {t('Cancel', 'Ακύρωση')}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5" />
              {t('Who to match with', 'Με ποιον να γίνει match')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFlexibility('prefer_topic')}
                className={`min-h-11 px-3 rounded-xl border text-left text-sm font-semibold ${
                  flexibility === 'prefer_topic'
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {t('Prefer same topic', 'Προτίμηση ίδιου θέματος')}
              </button>
              <button
                type="button"
                onClick={() => setFlexibility('any_study')}
                className={`min-h-11 px-3 rounded-xl border text-left text-sm font-semibold ${
                  flexibility === 'any_study'
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {t('Any study buddy', 'Οποιοσδήποτε study buddy')}
              </button>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              {t('Subject / topic', 'Μάθημα / θέμα')}
              {flexibility === 'any_study' ? (
                <span className="normal-case font-medium text-slate-400">
                  ({t('optional', 'προαιρετικό')})
                </span>
              ) : null}
            </span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('e.g. Organic Chem', 'π.χ. Οργανική Χημεία')}
              maxLength={120}
              className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTopic(s)}
                className={`px-3 py-2 min-h-10 rounded-xl border text-xs font-medium touch-manipulation ${
                  topic === s
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5" />
              {t('Session length', 'Διάρκεια')}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {MATCH_DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`min-h-11 rounded-xl border text-sm font-semibold ${
                    duration === d
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {d}′
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              {t('Study vibe', 'Ύφος μελέτης')}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {STUDY_VIBES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVibe(v)}
                  className={`min-h-11 px-2 rounded-xl border text-xs font-semibold ${
                    vibe === v
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t(VIBE_LABELS[v].en, VIBE_LABELS[v].el)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              {t('Energy', 'Ενέργεια')}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {STUDY_ENERGIES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEnergy(e)}
                  className={`min-h-11 px-2 rounded-xl border text-xs font-semibold ${
                    energy === e
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t(ENERGY_LABELS[e].en, ENERGY_LABELS[e].el)}
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              {t('Session intention (optional)', 'Στόχος συνεδρίας (προαιρετικό)')}
            </span>
            <input
              value={sessionGoal}
              onChange={(e) => setSessionGoal(e.target.value)}
              placeholder={t('e.g. Finish chapter 4 problems', 'π.χ. Να τελειώσω τις ασκήσεις κεφ. 4')}
              maxLength={160}
              className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              {t('School domain filter (optional)', 'Φίλτρο domain σχολής (προαιρετικό)')}
            </span>
            <input
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value.toLowerCase())}
              placeholder={userDomain || 'uni.edu'}
              maxLength={120}
              disabled={demo}
              className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm disabled:opacity-50"
            />
            <p className="text-[11px] text-slate-400">
              {t(
                'Only match classmates whose email ends with this domain. Leave empty for any verified student.',
                'Match μόνο με email στο ίδιο domain. Άδειο = οποιοσδήποτε επαληθευμένος φοιτητής.',
              )}
            </p>
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleFind()}
            className="w-full min-h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 touch-manipulation"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {t('Find a focus buddy', 'Βρες focus buddy')}
          </button>

          <p className="text-center text-xs text-slate-400">
            <Link to="/circles" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
              {t('Prefer invite-only Study Circles?', 'Προτιμάς Κύκλους μόνο με πρόσκληση;')}
            </Link>
          </p>
        </div>
      )}

      <CommunityGuidelinesModal
        open={showGuidelines}
        onAccept={() => setShowGuidelines(false)}
      />
    </div>
  );
}
