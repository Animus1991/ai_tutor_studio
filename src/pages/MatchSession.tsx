import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Timer,
  Flag,
  LogOut,
  Send,
  Video,
  StickyNote,
  PenTool,
  Shield,
  Check,
  Coffee,
  Circle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../lib/i18n';
import { isDemoModeActive } from '../lib/demoStorage';
import { useGoogleOAuth } from '../hooks/useGoogleOAuth';
import {
  MATCH_REPORT_REASONS,
  type MatchDuration,
  type MatchReportReason,
  type MatchSessionView,
  createMatchMeet,
  formatCountdown,
  getMatchSession,
  leaveMatchSession,
  matchHeartbeat,
  matchPomodoro,
  reportMatchSession,
  saveMatchNotes,
  secondsRemaining,
  sendMatchMessage,
  setMeetConsent,
} from '../lib/studyMatch';

function loadDemoSession(id: string): MatchSessionView | null {
  try {
    const raw = sessionStorage.getItem(`memora-demo-match:${id}`);
    return raw ? (JSON.parse(raw) as MatchSessionView) : null;
  } catch {
    return null;
  }
}

function saveDemoSession(session: MatchSessionView) {
  sessionStorage.setItem(`memora-demo-match:${session.id}`, JSON.stringify(session));
}

export default function MatchSession() {
  const { sessionId = '' } = useParams();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const demo = isDemoMode || isDemoModeActive() || sessionId.startsWith('demo-');
  const googleOAuth = useGoogleOAuth();

  const [session, setSession] = useState<MatchSessionView | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [notes, setNotes] = useState('');
  const [tab, setTab] = useState<'chat' | 'notes'>('chat');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<MatchReportReason>('off_topic');
  const [busy, setBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    if (demo) {
      const s = loadDemoSession(sessionId);
      if (!s) {
        toast.error(t('Demo session expired', 'Το demo session έληξε'));
        navigate('/match');
        return;
      }
      setSession(s);
      setNotes(s.notes);
      setRemaining(secondsRemaining(s.endsAt));
      return;
    }
    try {
      const s = await getMatchSession(sessionId);
      setSession(s);
      setNotes(s.notes);
      setRemaining(secondsRemaining(s.endsAt));
      if (s.status !== 'active') {
        toast.message(t('Session ended', 'Η συνεδρία ολοκληρώθηκε'));
        navigate('/match', { replace: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Session error');
      navigate('/match', { replace: true });
    }
  }, [demo, navigate, sessionId, t]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), demo ? 1000 : 2000);
    return () => window.clearInterval(id);
  }, [refresh, demo]);

  // Presence heartbeat (signed-in sessions)
  useEffect(() => {
    if (demo || !sessionId) return;
    const tick = () => {
      void matchHeartbeat(sessionId)
        .then((r) => {
          if (r.session) setSession(r.session);
        })
        .catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 8000);
    return () => window.clearInterval(id);
  }, [demo, sessionId]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!session) return;
      const phaseEnd = session.pomodoro?.phaseEndsAt ?? session.endsAt;
      const left = secondsRemaining(phaseEnd);
      setRemaining(left);
      if (left <= 0 && session.status === 'active' && session.pomodoro?.phase === 'focus') {
        // Auto-suggest break in demo; otherwise end focus block
        if (demo) {
          toast.message(t('Focus block done — start a 5′ break?', 'Τέλος focus — 5′ διάλειμμα;'));
        }
      }
      if (left <= 0 && session.status === 'active' && session.pomodoro?.phase === 'break') {
        toast.message(t('Break over — ready for another cycle?', 'Τέλος διαλείμματος — νέος κύκλος;'));
      }
      if (left <= 0 && session.status === 'active' && !session.pomodoro) {
        toast.message(t('Time is up — great focus block!', 'Ο χρόνος τελείωσε — μπράβο!'));
        navigate('/match', { replace: true });
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [session, navigate, t, demo]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages?.length]);

  const handleSend = async () => {
    const text = chatInput.trim();
    if (!text || !session) return;
    setChatInput('');
    if (demo) {
      const next: MatchSessionView = {
        ...session,
        messages: [
          ...session.messages,
          {
            id: `d-${Date.now()}`,
            userId: 'demo',
            displayName: 'You',
            text,
            createdAt: new Date().toISOString(),
          },
        ],
      };
      saveDemoSession(next);
      setSession(next);
      return;
    }
    try {
      const { session: next } = await sendMatchMessage(session.id, text);
      setSession(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed');
    }
  };

  const persistNotes = (value: string) => {
    setNotes(value);
    if (!session) return;
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      if (demo) {
        const next = { ...session, notes: value };
        saveDemoSession(next);
        setSession(next);
        return;
      }
      void saveMatchNotes(session.id, value).catch(() => undefined);
    }, 600);
  };

  const handleLeave = async () => {
    if (!session) return;
    setBusy(true);
    try {
      if (demo) {
        sessionStorage.removeItem(`memora-demo-match:${session.id}`);
      } else {
        await leaveMatchSession(session.id);
      }
      navigate('/match', { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Leave failed');
    } finally {
      setBusy(false);
    }
  };

  const handleReport = async () => {
    if (!session) return;
    setBusy(true);
    try {
      if (demo) {
        sessionStorage.removeItem(`memora-demo-match:${session.id}`);
        toast.success(t('Reported (demo) — you will not rematch', 'Αναφορά (demo) — δεν θα ξαναγίνει match'));
      } else {
        await reportMatchSession(session.id, { reason: reportReason });
        toast.success(t('Reported. You will not be matched again.', 'Καταχωρήθηκε. Δεν θα ξαναγίνει match.'));
      }
      setReportOpen(false);
      navigate('/match', { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Report failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleMeetConsent = async () => {
    if (!session) return;
    const selfKey = demo ? 'demo' : session.selfId;
    const nextVal = !session.meetConsent[selfKey];
    if (demo) {
      const next = {
        ...session,
        meetConsent: { ...session.meetConsent, [selfKey]: nextVal },
      };
      saveDemoSession(next);
      setSession(next);
      return;
    }
    try {
      const next = await setMeetConsent(session.id, nextVal);
      setSession(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Consent failed');
    }
  };

  const startMeet = async () => {
    if (!session) return;
    if (demo) {
      const peerOk = session.meetConsent.peer;
      const selfOk = session.meetConsent.demo;
      if (!selfOk) {
        toast.info(t('Opt in to Meet first', 'Ενεργοποίησε πρώτα το Meet'));
        return;
      }
      // In demo, simulate peer opt-in after self
      const next = {
        ...session,
        meetConsent: { demo: true, peer: true },
        meetUrl: 'https://meet.google.com/new',
      };
      saveDemoSession(next);
      setSession(next);
      window.open(next.meetUrl, '_blank', 'noopener,noreferrer');
      if (!peerOk) toast.message(t('Demo: peer also opted in', 'Demo: και ο peer συμφώνησε'));
      return;
    }
    if (!session.meetConsent[session.selfId] || !session.meetConsent[session.peerId]) {
      toast.info(t('Both buddies must opt in first', 'Πρέπει να συμφωνήσουν και οι δύο'));
      return;
    }
    try {
      const result = await createMatchMeet(session.id, googleOAuth.token);
      setSession(result.session);
      window.open(result.meetUrl, '_blank', 'noopener,noreferrer');
      if (result.fallback) {
        toast.message(t('Opened Meet fallback link', 'Άνοιξε fallback σύνδεσμος Meet'));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Meet failed');
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-sm text-slate-500">
        {t('Loading session…', 'Φόρτωση συνεδρίας…')}
      </div>
    );
  }

  const selfConsent = Boolean(session.meetConsent[demo ? 'demo' : session.selfId]);
  const peerConsent = Boolean(session.meetConsent[demo ? 'peer' : session.peerId]);
  const bothConsent = selfConsent && peerConsent;
  const phase = session.pomodoro?.phase ?? 'focus';
  const phaseTotalSec = (phase === 'break' ? (session.pomodoro?.breakMin ?? 5) : session.durationMin) * 60;
  const progress = Math.min(100, Math.max(0, (1 - remaining / Math.max(1, phaseTotalSec)) * 100));

  const runPomodoro = async (action: 'start_break' | 'start_focus') => {
    if (!session) return;
    if (demo) {
      const now = Date.now();
      const mins = action === 'start_break' ? 5 : session.durationMin;
      const phaseEndsAt = new Date(now + mins * 60_000).toISOString();
      const next: MatchSessionView = {
        ...session,
        endsAt: phaseEndsAt,
        pomodoro: {
          phase: action === 'start_break' ? 'break' : 'focus',
          cycle: action === 'start_focus' ? (session.pomodoro?.cycle ?? 1) + 1 : session.pomodoro?.cycle ?? 1,
          phaseStartedAt: new Date(now).toISOString(),
          phaseEndsAt,
          focusMin: session.durationMin,
          breakMin: 5,
        },
        messages: [
          ...session.messages,
          {
            id: `sys-${now}`,
            userId: 'system',
            displayName: 'Memora',
            text:
              action === 'start_break'
                ? t('Shared 5′ break started.', 'Ξεκίνησε κοινό διάλειμμα 5′.')
                : t('New focus cycle started.', 'Νέος κύκλος focus.'),
            createdAt: new Date(now).toISOString(),
          },
        ],
      };
      saveDemoSession(next);
      setSession(next);
      return;
    }
    try {
      const next = await matchPomodoro(
        session.id,
        action,
        action === 'start_focus' ? (session.durationMin as MatchDuration) : undefined,
      );
      setSession(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Pomodoro update failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-4" data-testid="match-session-page">
      <header className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              {phase === 'break'
                ? t('Shared break', 'Κοινό διάλειμμα')
                : t('Focus Pomodoro', 'Focus Pomodoro')}
              {session.pomodoro ? ` · #${session.pomodoro.cycle}` : ''}
            </p>
            <h1 className="text-lg sm:text-xl font-display font-bold text-slate-900 dark:text-white mt-0.5">
              {session.topicLabel}
              <span className="text-slate-400 font-medium"> · {session.durationMin}′</span>
            </h1>
            <p className="text-sm text-slate-500 mt-0.5 inline-flex items-center gap-1.5">
              <Circle
                className={`w-2.5 h-2.5 fill-current ${
                  session.peerOnline !== false ? 'text-emerald-500' : 'text-slate-300'
                }`}
              />
              {t('With', 'Με')} {session.peerDisplayName}
              <span className="text-slate-400">
                {session.peerOnline !== false
                  ? t('· online', '· online')
                  : t('· away', '· away')}
              </span>
              {demo ? ' (demo)' : ''}
            </p>
          </div>
          <div className="text-right">
            <div
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${
                phase === 'break'
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700'
              }`}
            >
              {phase === 'break' ? (
                <Coffee className="w-4 h-4 text-amber-600" />
              ) : (
                <Timer className="w-4 h-4 text-indigo-500" />
              )}
              <span className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {formatCountdown(remaining)}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-36 ml-auto rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  phase === 'break' ? 'bg-amber-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {phase === 'focus' ? (
            <button
              type="button"
              onClick={() => void runPomodoro('start_break')}
              className="min-h-10 px-3 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Coffee className="w-3.5 h-3.5" />
              {t('Start 5′ shared break', 'Έναρξη κοινού διαλείμματος 5′')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void runPomodoro('start_focus')}
              className="min-h-10 px-3 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Timer className="w-3.5 h-3.5" />
              {t('Start next focus cycle', 'Επόμενος κύκλος focus')}
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void toggleMeetConsent()}
            className={`min-h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${
              selfConsent
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {selfConsent ? <Check className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
            {selfConsent
              ? t('You opted into Meet', 'Συμφώνησες για Meet')
              : t('Opt in to Meet', 'Συμφωνώ για Meet')}
          </button>
          <span className="min-h-10 px-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center text-slate-400">
            {peerConsent
              ? t('Buddy opted in', 'Ο buddy συμφώνησε')
              : t('Waiting for buddy opt-in', 'Αναμονή συναίνεσης buddy')}
          </span>
          <button
            type="button"
            disabled={!bothConsent}
            onClick={() => void startMeet()}
            className="min-h-10 px-3 rounded-xl bg-indigo-600 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Video className="w-3.5 h-3.5" />
            {session.meetUrl ? t('Open Meet', 'Άνοιγμα Meet') : t('Start Meet', 'Έναρξη Meet')}
          </button>
          <Link
            to={`/collab?room=${encodeURIComponent(session.roomId)}`}
            className="min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
          >
            <PenTool className="w-3.5 h-3.5" />
            {t('Whiteboard', 'Whiteboard')}
          </Link>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="min-h-10 px-3 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Flag className="w-3.5 h-3.5" />
            {t('Report', 'Αναφορά')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleLeave()}
            className="min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('Leave', 'Έξοδος')}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 min-h-[50vh]">
        <div className="lg:col-span-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col min-h-[420px]">
          <div className="flex border-b border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTab('chat')}
              className={`flex-1 min-h-11 text-sm font-semibold ${
                tab === 'chat' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'
              }`}
            >
              {t('Chat', 'Chat')}
            </button>
            <button
              type="button"
              onClick={() => setTab('notes')}
              className={`flex-1 min-h-11 text-sm font-semibold inline-flex items-center justify-center gap-1.5 ${
                tab === 'notes' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'
              }`}
            >
              <StickyNote className="w-3.5 h-3.5" />
              {t('Shared notes', 'Κοινές σημειώσεις')}
            </button>
          </div>

          {tab === 'chat' ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(session.messages ?? []).map((m) => {
                  const mine = demo ? m.userId === 'demo' : m.userId === session.selfId;
                  const system = m.userId === 'system';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${system ? 'items-center' : mine ? 'items-end' : 'items-start'}`}
                    >
                      {!system && (
                        <span className="text-[11px] font-semibold text-slate-500 mb-0.5">
                          {mine ? t('You', 'Εσύ') : m.displayName}
                        </span>
                      )}
                      <div
                        className={`max-w-[90%] px-3.5 py-2 rounded-2xl text-sm ${
                          system
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs text-center'
                            : mine
                              ? 'bg-indigo-600 text-white rounded-tr-sm'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-sm'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <form
                className="p-3 border-t border-slate-100 dark:border-slate-800 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={t('Encourage, clarify, stay on topic…', 'Ενθάρρυνση, διευκρινίσεις, στο θέμα…')}
                  maxLength={1000}
                  className="flex-1 min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
                <button
                  type="submit"
                  className="min-h-11 min-w-11 rounded-xl bg-indigo-600 text-white inline-flex items-center justify-center"
                  aria-label={t('Send', 'Αποστολή')}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <textarea
              value={notes}
              onChange={(e) => persistNotes(e.target.value)}
              placeholder={t('Shared scratchpad for this focus block…', 'Κοινό scratchpad για αυτό το μπλοκ…')}
              className="flex-1 min-h-[320px] p-4 bg-transparent text-sm resize-none outline-none text-slate-800 dark:text-slate-100"
              maxLength={20000}
            />
          )}
        </div>

        <aside className="lg:col-span-2 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('Session rules', 'Κανόνες συνεδρίας')}
          </p>
          <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-4">
            <li>{t('Learning only — no dating / spam', 'Μόνο μάθηση — όχι dating / spam')}</li>
            <li>{t('No camera unless both opt into Meet', 'Όχι κάμερα χωρίς διπλή συναίνεση Meet')}</li>
            <li>{t('Peer email is never shown', 'Το email του άλλου δεν εμφανίζεται')}</li>
            <li>{t('Report ends the session and blocks rematch', 'Η αναφορά τερματίζει και μπλοκάρει rematch')}</li>
          </ul>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 space-y-1">
            <p>Room: <code className="text-slate-500">{session.roomId}</code></p>
            {session.domainFilter ? <p>Domain: @{session.domainFilter}</p> : null}
          </div>
        </aside>
      </div>

      {reportOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-6">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
            <h3 className="text-base font-display font-bold text-slate-900 dark:text-white mb-1">
              {t('Report & leave', 'Αναφορά & έξοδος')}
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              {t(
                'This ends the session and prevents rematching with this buddy.',
                'Τερματίζει τη συνεδρία και εμποδίζει νέο match με αυτόν τον buddy.',
              )}
            </p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value as MatchReportReason)}
              className="w-full min-h-11 mb-4 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            >
              {MATCH_REPORT_REASONS.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="flex-1 min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium"
              >
                {t('Cancel', 'Άκυρο')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleReport()}
                className="flex-1 min-h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
              >
                {t('Submit report', 'Υποβολή')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
