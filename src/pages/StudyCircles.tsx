import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UsersRound, Plus, Copy, Check, Shield, BookOpen, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../lib/i18n';
import { db } from '../lib/firebase';
import {
  circleCollabRoomId,
  createStudyCircle,
  hasAcceptedCommunityGuidelines,
  inviteToStudyCircle,
  isValidInviteEmail,
  listMyStudyCircles,
  type StudyCircle,
} from '../lib/safeSocial';
import { circleToMatchPath } from '../lib/socialPolicy';
import { isDemoModeActive } from '../lib/demoStorage';
import CommunityGuidelinesModal from '../components/CommunityGuidelinesModal';
import { PAGE_CONTENT } from '../components/layout/pageLayout';

const DEMO_CIRCLES: StudyCircle[] = [
  {
    id: 'demo-circle-1',
    name: 'Organic Chem Study Pod',
    topic: 'Midterm review',
    ownerId: 'demo',
    memberEmails: ['you@demo.local'],
    purpose: 'learning',
  },
];

export default function StudyCircles() {
  const { t } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const [circles, setCircles] = useState<StudyCircle[]>([]);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(() => !hasAcceptedCommunityGuidelines());

  const refresh = useCallback(async () => {
    if (isDemoMode || isDemoModeActive() || !user?.email) {
      setCircles(DEMO_CIRCLES);
      setSelected((prev) => prev ?? DEMO_CIRCLES[0]?.id ?? null);
      return;
    }
    setLoading(true);
    try {
      const list = await listMyStudyCircles(db, user.email);
      setCircles(list);
      if (list.length && !selected) setSelected(list[0].id);
    } catch {
      toast.error(t('Could not load study circles', 'Αδυναμία φόρτωσης κύκλων μελέτης'));
    } finally {
      setLoading(false);
    }
  }, [isDemoMode, user?.email, selected, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = circles.find((c) => c.id === selected) ?? null;

  const handleCreate = async () => {
    if (!name.trim()) return;
    if (isDemoMode || isDemoModeActive()) {
      const c: StudyCircle = {
        id: `demo-${Date.now()}`,
        name: name.trim(),
        topic: topic.trim() || 'General study',
        ownerId: 'demo',
        memberEmails: ['you@demo.local'],
        purpose: 'learning',
      };
      setCircles((prev) => [c, ...prev]);
      setSelected(c.id);
      setName('');
      setTopic('');
      toast.success(t('Circle created (demo)', 'Ο κύκλος δημιουργήθηκε (demo)'));
      return;
    }
    if (!user?.email) {
      toast.error(t('Sign in with a verified Google account', 'Συνδέσου με επαληθευμένο Google λογαριασμό'));
      return;
    }
    try {
      const id = await createStudyCircle(db, {
        name: name.trim(),
        topic: topic.trim() || 'General study',
        ownerId: user.uid,
        ownerEmail: user.email,
      });
      const { postLearningEvent, postAuditBeacon } = await import('../lib/spineEvents');
      postAuditBeacon('CIRCLE_CREATE', { circleId: id });
      postLearningEvent({
        kind: 'focus_session',
        surface: 'circles',
        domainKey: topic.trim() || 'General study',
        success: true,
        principles: ['self_determination'],
      });
      setName('');
      setTopic('');
      toast.success(t('Study circle created', 'Ο κύκλος μελέτης δημιουργήθηκε'));
      await refresh();
      setSelected(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleInvite = async () => {
    if (!active || !inviteEmail.trim()) return;
    if (isDemoMode || isDemoModeActive()) {
      toast.info(t('Invites require a signed-in account outside demo.', 'Οι προσκλήσεις χρειάζονται λογαριασμό εκτός demo.'));
      return;
    }
    if (!user?.uid) return;
    if (active.ownerId !== user.uid) {
      toast.error(t('Only the circle owner can invite classmates.', 'Μόνο ο δημιουργός του κύκλου μπορεί να προσκαλεί.'));
      return;
    }
    if (!isValidInviteEmail(inviteEmail)) {
      toast.error(t('Enter a valid email address', 'Βάλε έγκυρο email'));
      return;
    }
    try {
      const next = await inviteToStudyCircle(
        db,
        active.id,
        inviteEmail,
        active.memberEmails,
        active.ownerId,
      );
      setCircles((prev) =>
        prev.map((c) => (c.id === active.id ? { ...c, memberEmails: next } : c)),
      );
      setInviteEmail('');
      toast.success(t('Invite added (invite-only circle)', 'Προστέθηκε πρόσκληση (μόνο με πρόσκληση)'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const openCollab = () => {
    if (!active) return;
    void import('../lib/spineEvents').then(({ postLearningEvent, postAuditBeacon }) => {
      postLearningEvent({
        kind: 'focus_session',
        surface: 'circles',
        domainKey: active.topic,
        success: true,
        principles: ['self_determination', 'retrieval'],
      });
      postAuditBeacon('CIRCLE_OPEN', { circleId: active.id, topic: active.topic });
    });
    return `/collab?room=${encodeURIComponent(circleCollabRoomId(active.id))}`;
  };

  const copyLink = async () => {
    const path = openCollab();
    if (!path) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast.success(t('Private circle room link copied', 'Αντιγράφηκε ιδιωτικός σύνδεσμος'));
    } catch {
      toast.error(t('Could not copy link', 'Αδυναμία αντιγραφής'));
    }
  };

  return (
    <div className={`${PAGE_CONTENT} space-y-5`} data-testid="study-circles-page">
      <header className="ux-page-header">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <UsersRound className="w-6 h-6 text-indigo-500" />
            {t('Study Circles', 'Κύκλοι Μελέτης')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'Invite-only peer groups for learning — no public feed, no stranger DMs.',
              'Ομάδες συνομηλίκων μόνο με πρόσκληση — χωρίς δημόσιο feed, χωρίς DM από αγνώστους.',
            )}
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5 flex gap-3 text-sm text-emerald-900 dark:text-emerald-200">
        <Shield className="w-5 h-5 shrink-0 mt-0.5" />
        <p>
          {t(
            'Circles are for coursework help and accountability. Report unsafe messages in the Collab room. Verified email required outside demo.',
            'Οι κύκλοι είναι για βοήθεια μαθημάτων και υπευθυνότητα. Ανέφερε μη ασφαλή μηνύματα στο Collab. Εκτός demo απαιτείται επαληθευμένο email.',
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="md:col-span-2 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> {t('New circle', 'Νέος κύκλος')}
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Circle name', 'Όνομα κύκλου')}
            className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            maxLength={80}
          />
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('Topic (e.g. Calculus midterm)', 'Θέμα (π.χ. πρόοδος Λογισμού)')}
            className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            maxLength={120}
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            className="w-full min-h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold touch-manipulation"
          >
            {t('Create invite-only circle', 'Δημιουργία κύκλου')}
          </button>
        </div>

        <div className="md:col-span-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('Your circles', 'Οι κύκλοι σου')} {loading ? '…' : `(${circles.length})`}
          </p>
          <div className="flex flex-wrap gap-2">
            {circles.length === 0 && (
              <p className="text-sm text-slate-400">{t('No circles yet.', 'Κανένας κύκλος ακόμη.')}</p>
            )}
            {circles.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
                className={`px-3.5 py-2.5 min-h-11 rounded-xl border text-sm font-medium touch-manipulation ${
                  selected === c.id
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {active && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{active.name}</p>
                  <p className="text-xs text-slate-500">{active.topic} · {active.memberEmails.length} {t('members', 'μέλη')}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={openCollab()!}
                  className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold"
                >
                  {t('Open study room', 'Άνοιγμα δωματίου')}
                </Link>
                <Link
                  to={circleToMatchPath(active.topic, active.id)}
                  className="inline-flex items-center gap-1.5 justify-center min-h-11 px-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-sm font-semibold"
                  title={t(
                    'Find a focus buddy on this topic (same safety rules as Match)',
                    'Βρες focus buddy στο θέμα (ίδιοι κανόνες ασφαλείας με το Match)',
                  )}
                >
                  <Timer className="w-4 h-4" />
                  {t('Focus buddy', 'Focus buddy')}
                </Link>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  {t('Copy private link', 'Αντιγραφή συνδέσμου')}
                </button>
              </div>
              {(isDemoMode || isDemoModeActive() || (user && active.ownerId === user.uid)) && (
                <div className="flex gap-2">
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={t('Invite by email', 'Πρόσκληση με email')}
                    className="flex-1 min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                    type="email"
                  />
                  <button
                    type="button"
                    onClick={() => void handleInvite()}
                    className="min-h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold"
                  >
                    {t('Invite', 'Πρόσκληση')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CommunityGuidelinesModal
        open={showGuidelines}
        onAccept={() => setShowGuidelines(false)}
      />
    </div>
  );
}
