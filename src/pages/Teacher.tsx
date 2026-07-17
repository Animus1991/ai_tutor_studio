import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Users, Target, AlarmClock, Plus, LogIn, Copy, Check, RefreshCw, Activity } from 'lucide-react';
import { toast } from 'sonner';
import {
  listClasses, createClass, joinClass, classDetail,
  type ClassSummary, type ClassDetail,
} from '../lib/teacher';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../lib/i18n';

function masteryColor(v: number): string {
  if (v >= 85) return 'bg-emerald-500';
  if (v >= 70) return 'bg-lime-500';
  if (v >= 55) return 'bg-amber-500';
  if (v >= 40) return 'bg-orange-500';
  if (v > 0) return 'bg-rose-500';
  return 'bg-slate-200 dark:bg-slate-700';
}

function Kpi({ icon: Icon, label, value, tint }: { icon: typeof Users; label: string; value: string | number; tint: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tint}`}>
          <Icon className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-2xl font-display font-bold text-slate-900 dark:text-white leading-none tracking-tight">{value}</p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
}

const DEMO_CLASS: ClassSummary = {
  id: 'demo-chem',
  name: 'Demo Chemistry',
  teacherName: 'You',
  role: 'teacher',
  memberCount: 3,
  joinCode: 'DEMO01',
};

const DEMO_DETAIL: ClassDetail = {
  id: 'demo-chem',
  name: 'Demo Chemistry',
  joinCode: 'DEMO01',
  role: 'teacher',
  subjects: ['Acids', 'Bonds', 'Stoichiometry'],
  aggregates: { studentCount: 2, avgMastery: 78, totalDue: 17, activeCount: 2 },
  students: [
    {
      userId: 'demo-s1',
      name: 'Alex',
      email: 'alex@demo.local',
      masteryPct: 82,
      cardsDue: 5,
      streak: 4,
      studyMinutes: 120,
      subjects: [
        { name: 'Acids', mastery: 88 },
        { name: 'Bonds', mastery: 76 },
        { name: 'Stoichiometry', mastery: 81 },
      ],
      updatedAt: new Date().toISOString(),
    },
    {
      userId: 'demo-s2',
      name: 'Maria',
      email: 'maria@demo.local',
      masteryPct: 74,
      cardsDue: 12,
      streak: 2,
      studyMinutes: 90,
      subjects: [
        { name: 'Acids', mastery: 70 },
        { name: 'Bonds', mastery: 68 },
        { name: 'Stoichiometry', mastery: 84 },
      ],
      updatedAt: new Date().toISOString(),
    },
  ],
};

export default function Teacher() {
  const { t } = useLanguage();
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const user = useAuthStore((s) => s.user);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const authed = isDemoMode || !!user;

  const refresh = useCallback(async () => {
    if (!authed) return;
    if (isDemoMode) {
      setClasses([DEMO_CLASS]);
      setSelected((prev) => prev ?? DEMO_CLASS.id);
      return;
    }
    try {
      const { classes: cs } = await listClasses();
      setClasses(cs);
      if (cs.length && !selected) setSelected(cs[0].id);
    } catch { /* not authed */ }
  }, [authed, isDemoMode, selected]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    if (isDemoMode) {
      setDetail(DEMO_DETAIL);
      setLoading(false);
      return;
    }
    setLoading(true);
    classDetail(selected).then(setDetail).catch(() => setDetail(null)).finally(() => setLoading(false));
  }, [selected, isDemoMode]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    if (isDemoMode) {
      const c: ClassSummary = {
        id: `demo-${Date.now()}`,
        name: newName.trim(),
        role: 'teacher',
        memberCount: 1,
        joinCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      };
      setClasses((prev) => [...prev, c]);
      setNewName('');
      setSelected(c.id);
      toast.success(t('Class created (demo)', 'Η τάξη δημιουργήθηκε (demo)'));
      return;
    }
    try {
      const c = await createClass(newName.trim());
      setNewName('');
      toast.success(t('Class created', 'Η τάξη δημιουργήθηκε'));
      await refresh();
      setSelected(c.id);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    if (isDemoMode) {
      toast.info(t('Join requires a signed-in account outside demo.', 'Η εγγραφή απαιτεί λογαριασμό εκτός demo.'));
      return;
    }
    try {
      const c = await joinClass(code.trim());
      setCode('');
      toast.success(t('Joined class', 'Εγγραφή στην τάξη'));
      await refresh();
      setSelected(c.id);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };

  const copyCode = (jc: string) => {
    void navigator.clipboard.writeText(jc);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (!authed) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-20" data-testid="teacher-page">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800/40 flex items-center justify-center">
          <GraduationCap className="w-8 h-8 text-indigo-500" strokeWidth={1.5} />
        </div>
        <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white tracking-tight">{t('Teacher Dashboard', 'Πίνακας Εκπαιδευτικού')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          {t('Sign in with an account to create classes and track student mastery.',
             'Συνδέσου με λογαριασμό για να δημιουργήσεις τάξεις και να παρακολουθείς την πρόοδο.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="teacher-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">{t('Teacher Dashboard', 'Πίνακας Εκπαιδευτικού')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isDemoMode
              ? t('Demo sandbox — sample class with live UI (sign in for real Firestore classes).',
                  'Demo sandbox — δείγμα τάξης με ζωντανό UI (σύνδεση για πραγματικές τάξεις Firestore).')
              : t('Class analytics, mastery heatmap and pending reviews.', 'Ανάλυση τάξης, θερμικός χάρτης κατάκτησης & εκκρεμείς επαναλήψεις.')}
          </p>
        </div>
        <button onClick={() => void refresh()} data-testid="teacher-refresh" className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
          <RefreshCw className="w-4 h-4" /> {t('Refresh', 'Ανανέωση')}
        </button>
      </div>

      {/* Class controls */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-4 shadow-sm space-y-3">
          <div className="flex gap-2">
            <input data-testid="new-class-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('New class name', 'Όνομα νέας τάξης')} className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" />
            <button data-testid="create-class-btn" onClick={() => void handleCreate()} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-1"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-2">
            <input data-testid="join-code-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('Join code', 'Κωδικός εγγραφής')} className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white uppercase" />
            <button data-testid="join-class-btn" onClick={() => void handleJoin()} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-1"><LogIn className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-2 items-start">
          {classes.length === 0 && <p className="text-sm text-slate-400 p-2">{t('No classes yet — create one or join with a code.', 'Καμία τάξη ακόμη — δημιούργησε ή μπες με κωδικό.')}</p>}
          {classes.map((c) => (
            <button key={c.id} data-testid={`class-pill-${c.id}`} onClick={() => setSelected(c.id)}
              className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${selected === c.id ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              {c.name} <span className="text-xs opacity-60">· {c.memberCount} · {c.role === 'teacher' ? t('Teacher', 'Εκπ/κός') : t('Student', 'Μαθητής')}</span>
            </button>
          ))}
        </div>
      </div>

      {detail && (
        <>
          {detail.joinCode && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">{t('Share join code:', 'Κωδικός εγγραφής:')}</span>
              <button onClick={() => copyCode(detail.joinCode!)} data-testid="copy-join-code" className="inline-flex items-center gap-1.5 font-mono font-bold px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400">
                {detail.joinCode} {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="teacher-kpis">
            <Kpi icon={Users} label={t('Students', 'Μαθητές')} value={detail.aggregates.studentCount} tint="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" />
            <Kpi icon={Target} label={t('Avg. mastery', 'Μ.Ο. κατάκτησης')} value={`${detail.aggregates.avgMastery}%`} tint="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" />
            <Kpi icon={AlarmClock} label={t('Due reviews', 'Εκκρεμείς')} value={detail.aggregates.totalDue} tint="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" />
            <Kpi icon={Activity} label={t('Active', 'Ενεργοί')} value={detail.aggregates.activeCount} tint="bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400" />
          </div>

          {/* Mastery heatmap */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 shadow-sm overflow-x-auto" data-testid="mastery-heatmap">
            <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white mb-3 tracking-tight">{t('Mastery heatmap (estimated)', 'Θερμικός χάρτης κατάκτησης (εκτίμηση)')}</h3>
            {detail.students.length === 0 ? (
              <p className="text-sm text-slate-400">{t('No students have joined or reported progress yet.', 'Κανένας μαθητής δεν έχει εγγραφεί/αναφέρει πρόοδο ακόμη.')}</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 pb-2 pr-4">{t('Student', 'Μαθητής')}</th>
                    {detail.subjects.slice(0, 8).map((s) => (
                      <th key={s} className="px-1 pb-2 text-xs font-medium text-slate-400 max-w-[90px] truncate" title={s}>{s}</th>
                    ))}
                    {detail.subjects.length === 0 && <th className="text-xs font-medium text-slate-400 pb-2">{t('Overall', 'Συνολικά')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {detail.students.map((st) => {
                    const map = new Map(st.subjects.map((s) => [s.name, s.mastery]));
                    return (
                      <tr key={st.userId} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 text-slate-700 dark:text-slate-200 whitespace-nowrap">{st.name}</td>
                        {detail.subjects.length > 0 ? detail.subjects.slice(0, 8).map((subj) => {
                          const v = Math.round(map.get(subj) ?? 0);
                          return (
                            <td key={subj} className="px-1 py-1">
                              <div className={`h-7 rounded-md ${masteryColor(v)} flex items-center justify-center text-[10px] font-bold text-white/90`} title={`${subj}: ${v}%`}>{v || ''}</div>
                            </td>
                          );
                        }) : (
                          <td className="px-1 py-1">
                            <div className={`h-7 rounded-md ${masteryColor(st.masteryPct)} flex items-center justify-center text-[10px] font-bold text-white/90`}>{Math.round(st.masteryPct)}%</div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pending reviews + roster */}
          <div className="grid lg:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 shadow-sm">
              <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white mb-3 tracking-tight">{t('Pending reviews', 'Εκκρεμείς επαναλήψεις')}</h3>
              <div className="space-y-2" data-testid="pending-reviews">
                {[...detail.students].sort((a, b) => b.cardsDue - a.cardsDue).slice(0, 8).map((st) => (
                  <div key={st.userId} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-200">{st.name}</span>
                    <span className={`font-semibold ${st.cardsDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{st.cardsDue} {t('due', 'εκκρ.')}</span>
                  </div>
                ))}
                {detail.students.length === 0 && <p className="text-sm text-slate-400">—</p>}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 shadow-sm">
              <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white mb-3 tracking-tight">{t('Roster', 'Κατάλογος')}</h3>
              <div className="space-y-2">
                {detail.students.map((st) => (
                  <motion.div key={st.userId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">{st.name.slice(0, 1).toUpperCase()}</div>
                      <span className="truncate text-slate-700 dark:text-slate-200">{st.name}</span>
                    </div>
                    <span className="text-xs text-slate-400">{t('streak', 'σερί')} {st.streak} · {Math.round(st.masteryPct)}%</span>
                  </motion.div>
                ))}
                {detail.students.length === 0 && <p className="text-sm text-slate-400">—</p>}
              </div>
            </div>
          </div>
        </>
      )}
      {loading && <p className="text-sm text-slate-400" data-testid="teacher-loading">{t('Loading class…', 'Φόρτωση τάξης…')}</p>}
    </div>
  );
}
