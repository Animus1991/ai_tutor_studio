import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Timer,
  Shield,
  Sparkles,
  BookOpen,
  Loader2,
  GraduationCap,
  Users,
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
import {
  MATCH_DURATIONS,
  type MatchDuration,
  buddyDisplayName,
  canonicalTopicKey,
  emailDomain,
  enqueueMatch,
  getMatchStatus,
  isValidDomainFilter,
  leaveMatchQueue,
} from '../lib/studyMatch';

type Phase = 'form' | 'waiting';

export default function StudyMatch() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const courses = useLibraryStore((s) => s.courses);
  const hydrate = useLibraryStore((s) => s.hydrate);

  const demo = isDemoMode || isDemoModeActive();
  const [showGuidelines, setShowGuidelines] = useState(() => !hasAcceptedCommunityGuidelines());
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState<MatchDuration>(25);
  const [domainFilter, setDomainFilter] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [busy, setBusy] = useState(false);
  const [queuedAt, setQueuedAt] = useState<string | null>(null);
  const [waitSecs, setWaitSecs] = useState(0);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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
    const label = topic.trim() || 'Organic Chemistry';
    const id = `demo-ms-${Date.now()}`;
    const now = Date.now();
    const endsAt = new Date(now + duration * 60_000).toISOString();
    const peerName = buddyDisplayName('demo-peer');
    const session = {
      id,
      topicLabel: label,
      topicKey: canonicalTopicKey(label),
      durationMin: duration,
      roomId: `match-${id}`.slice(0, 64),
      status: 'active' as const,
      startedAt: new Date(now).toISOString(),
      endsAt,
      notes: `# ${label}\n\n- Shared scratchpad (demo)\n- No stranger DMs after this block\n`,
      messages: [
        {
          id: 'sys1',
          userId: 'system',
          displayName: 'Memora',
          text: `Focus Pomodoro: ${label} · ${duration}′. Camera off. ${peerName} joined.`,
          createdAt: new Date(now).toISOString(),
        },
        {
          id: 'peer1',
          userId: 'demo-peer',
          displayName: peerName,
          text: t(
            "Hey — I'm reviewing the same topic. Let's stay muted and check in at the halfway mark?",
            'Γεια — διαβάζω το ίδιο θέμα. Μένουμε focused και check-in στη μέση;',
          ),
          createdAt: new Date(now + 800).toISOString(),
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
    if (label.length < 2) {
      toast.error(t('Enter a subject / topic', 'Βάλε μάθημα / θέμα'));
      return;
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
              'Time-boxed focus with someone reading the same topic — no public profiles, no stranger DMs after.',
              'Χρονισμένη συγκέντρωση με κάποιον στο ίδιο θέμα — χωρίς δημόσια προφίλ, χωρίς DM μετά.',
            )}
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5 flex gap-3 text-sm text-emerald-900 dark:text-emerald-200">
        <Shield className="w-5 h-5 shrink-0 mt-0.5" />
        <ul className="space-y-1 list-disc pl-4">
          <li>{t('Verified Google email required (outside demo)', 'Απαιτείται επαληθευμένο Google email (εκτός demo)')}</li>
          <li>{t('Camera off by default — chat, notes, whiteboard', 'Κάμερα off — chat, σημειώσεις, whiteboard')}</li>
          <li>{t('Meet only if both opt in · Instant report & leave', 'Meet μόνο με διπλή συναίνεση · Άμεση αναφορά & έξοδος')}</li>
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
              {topic} · {duration} {t('min', 'λεπτά')}
              {queuedAt ? ` · ${waitSecs}s` : ''}
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
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              {t('Subject / topic', 'Μάθημα / θέμα')}
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
