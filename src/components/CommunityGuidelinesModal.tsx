import { ShieldCheck, BookOpen, HeartHandshake, Flag } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../lib/i18n';
import { acceptCommunityGuidelines } from '../lib/safeSocial';

type Props = {
  open: boolean;
  onAccept: () => void;
};

export default function CommunityGuidelinesModal({ open, onAccept }: Props) {
  const { t } = useLanguage();
  if (!open) return null;

  const accept = () => {
    acceptCommunityGuidelines();
    onAccept();
  };

  const points = [
    {
      icon: BookOpen,
      title: t('Learning only', 'Μόνο μάθηση'),
      body: t(
        'Spaces are for studying together — not dating, spam, or off-topic chatter.',
        'Οι χώροι είναι για μελέτη μαζί — όχι για γνωριμίες, spam ή άσχετη συζήτηση.',
      ),
    },
    {
      icon: HeartHandshake,
      title: t('Be kind & respectful', 'Καλοσύνη & σεβασμός'),
      body: t(
        'No harassment, hate, or sharing others’ private information.',
        'Όχι παρενόχληση, μίσος ή κοινοποίηση προσωπικών δεδομένων άλλων.',
      ),
    },
    {
      icon: Flag,
      title: t('Report problems', 'Αναφορά προβλημάτων'),
      body: t(
        'Use Report on any message that breaks these rules. Invite-only rooms keep strangers out.',
        'Χρησιμοποίησε Αναφορά σε μηνύματα που παραβιάζουν τους κανόνες. Τα δωμάτια είναι μόνο με πρόσκληση.',
      ),
    },
    {
      icon: ShieldCheck,
      title: t('Verified accounts', 'Επαληθευμένοι λογαριασμοί'),
      body: t(
        'Collaboration requires a verified Google email. Demo mode stays on your device only.',
        'Η συνεργασία απαιτεί επαληθευμένο Google email. Το demo μένει μόνο στη συσκευή σου.',
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="guidelines-title">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg max-h-[min(90dvh,640px)] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex justify-center sm:hidden pb-2" aria-hidden>
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 id="guidelines-title" className="text-lg font-display font-bold text-slate-900 dark:text-white tracking-tight">
              {t('Community guidelines', 'Οδηγίες κοινότητας')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('Required before joining peer study spaces', 'Απαραίτητο πριν μπεις σε χώρους συνεργασίας')}
            </p>
          </div>
        </div>
        <ul className="space-y-3 mb-5">
          {points.map((p) => {
            const Icon = p.icon;
            return (
              <li key={p.title} className="flex gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3">
                <Icon className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{p.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{p.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={accept}
          className="w-full min-h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold touch-manipulation"
        >
          {t('I agree — continue to study spaces', 'Συμφωνώ — συνέχεια στους χώρους μελέτης')}
        </button>
      </motion.div>
    </div>
  );
}
