import { Outlet, Link, useLocation } from 'react-router-dom';
import { BookOpen, CheckSquare, MessageSquare, Settings, BrainCircuit, Bell, Menu, Users, Shield, LayoutDashboard, Calendar as CalendarIcon, HelpCircle, Type, Sparkles, Upload, Zap, Sun, Moon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { useAuthStore, Role } from '../../store/useAuthStore';
import { auditLogger } from '../../lib/auditLogger';
import { useState, useEffect } from 'react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useStudyReminders } from '../../hooks/useStudyReminders';
import CommandPalette from '../CommandPalette';
import SyncIndicator from '../SyncIndicator';
import ActivityDrawer from '../ActivityDrawer';
import FeedbackModal from '../FeedbackModal';
import SettingsModal from '../SettingsModal';
import ShortcutsModal from '../ShortcutsModal';
import BatteryIndicator from '../BatteryIndicator';
import { toast } from 'sonner';
import { isFullBleedRoute, CONTENT_GUTTER } from './pageLayout';
import SkipLink from '../SkipLink';
import { useLanguage } from '../../lib/i18n';
import AuthUserMenu from '../AuthUserMenu';

export default function Layout() {
  useKeyboardShortcuts();
  useStudyReminders();
  const { t } = useLanguage();
  const location = useLocation();
  const { isDarkMode, toggleDarkMode, isFocusMode, toggleFocusMode, isDyslexiaFont, toggleDyslexiaFont, xp, streakFreezes } = useStore();
  const { userRole, setUserRole } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Track page navigation once per path per browser session (StrictMode-safe)
  useEffect(() => {
    const key = `memora-audit-path:${location.pathname}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    auditLogger.log('APP_ACCESSED', 'current_user', undefined, { path: location.pathname });
  }, [location.pathname]);

  useEffect(() => {
    // Simulate upcoming task / streak notifications
    const timeout = setTimeout(() => {
      toast(t('System Update: Background sync is now enabled.', 'Ενημέρωση: Ο συγχρονισμός στο παρασκήνιο είναι ενεργός.'));
    }, 5000);

    const taskTimeout = setTimeout(() => {
      toast.info(t("Upcoming Task: 'Review Math Concepts' is due in 30 minutes.", 'Εργασία: Η Επανάληψη Μαθηματικών λήγει σε 30 λεπτά.'));
    }, 15000);

    return () => {
      clearTimeout(timeout);
      clearTimeout(taskTimeout);
    };
  }, []);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as Role;
    setUserRole(newRole);
    auditLogger.log('ROLE_CHANGED', 'current_user', undefined, { newRole });
  };


  const navItems = [
    { name: t('Dashboard', 'Πίνακας'), subtitle: t('Overview & Stats', 'Επισκόπηση & Στατιστικά'), path: '/', icon: LayoutDashboard },
    { name: t('Library', 'Βιβλιοθήκη'), subtitle: t('Your study materials', 'Το υλικό μελέτης σου'), path: '/library', icon: BookOpen },
    { name: t('Tasks', 'Εργασίες'), subtitle: t('Due reviews & goals', 'Εκκρεμείς ασκήσεις'), path: '/tasks', icon: CheckSquare },
    { name: t('Agent', 'Βοηθός'), subtitle: t('AI tutor chat', 'Συνομιλία AI'), path: '/agent', icon: MessageSquare },
    { name: t('Collab Space', 'Συνεργασία'), subtitle: t('Work with peers', 'Συνεργασία'), path: '/collab', icon: Users },
    { name: t('Workspace', 'Χώρος Εργασίας'), subtitle: t('Deep study tools', 'Εργαλεία μελέτης'), path: '/workspace', icon: CalendarIcon },
  ];

  const quickActions = [
    { label: t('Upload Material', 'Ανέβασε Υλικό'), icon: Upload, color: 'text-emerald-500', bg: 'bg-emerald-500/10', path: '/library' },
    { label: t('Quick Quiz', 'Γρήγορο Quiz'), icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10', path: '/agent' },
    { label: t('AI Agent', 'Βοηθός AI'), icon: Sparkles, color: 'text-indigo-500', bg: 'bg-indigo-500/10', path: '/agent' },
  ];

  if (userRole === 'admin' || userRole === 'instructor') {
    navItems.push({ name: t('Admin Dashboard', 'Διαχείριση'), subtitle: t('Manage platform', 'Διαχείριση'), path: '/admin', icon: Settings });
  }

  return (
    <div className="flex h-screen w-full min-w-0 bg-[#FAFAFA] dark:bg-[#020617] text-slate-900 dark:text-slate-50 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/50 selection:text-indigo-900 dark:selection:text-indigo-100 transition-colors duration-300">
      <SkipLink />
      {/* Sidebar (Desktop) */}
      {!isFocusMode && (
        <aside className="hidden md:flex w-16 lg:w-56 bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800/60 flex-col transition-all duration-300 relative z-20 no-print">
          <div className="h-16 flex items-center justify-center lg:justify-start lg:px-5 border-b border-slate-100/50 dark:border-slate-800/50">
          <div className="relative group flex items-center gap-2.5 cursor-pointer">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-1.5 rounded-xl shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/30 transition-all">
              <BrainCircuit className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <span className="hidden lg:block text-lg font-display font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Memora
            </span>
          </div>
        </div>
        
        <nav aria-label="Main Navigation" className="flex-1 px-2 py-5 space-y-1 overflow-y-auto min-h-0">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                title={item.name}
                className="relative flex items-center lg:px-3 py-3 justify-center lg:justify-start rounded-xl font-medium transition-all duration-200 group text-sm"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl shadow-sm shadow-indigo-500/20"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                {!isActive && (
                  <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 bg-slate-50 dark:bg-slate-800/60 transition-opacity" />
                )}
                <div className={cn('relative z-10 flex items-center justify-between w-full gap-2', isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white')}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={cn('w-4 h-4 shrink-0 transition-transform', isActive ? 'scale-110' : 'group-hover:scale-105')} strokeWidth={isActive ? 2 : 1.5} />
                    <span className="hidden lg:block min-w-0">
                      <span className="block text-sm truncate">{item.name}</span>
                      {item.subtitle && (
                        <span className={cn('block text-xs font-normal truncate mt-0.5', isActive ? 'text-white/70' : 'text-slate-500 dark:text-slate-400')}>
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                  </div>
                  {index < 4 && (
                    <span className={cn(
                      'hidden lg:block text-xs px-1.5 py-0.5 rounded font-mono border shrink-0',
                      isActive
                        ? 'bg-white/20 border-white/20 text-white/80'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                    )}>
                      ⌥{index + 1}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

          {/* Quick Access */}
          <div className="hidden lg:block pt-4 pb-2">
            <p className="section-eyebrow px-3 mb-2">{t('Quick Access', 'Γρήγορη Πρόσβαση')}</p>
          </div>
          {quickActions.map((action) => {
            const QIcon = action.icon;
            return (
              <Link
                key={action.label}
                to={action.path}
                className="hidden lg:flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
              >
                <span className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0', action.bg)}>
                  <QIcon className={cn('w-3 h-3', action.color)} strokeWidth={1.5} />
                </span>
                <span className="truncate">{action.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-slate-100/50 dark:border-slate-800/50 space-y-1">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            aria-label={t('Open settings', 'Άνοιγμα ρυθμίσεων')}
            title={t('Settings', 'Ρυθμίσεις')}
            className="flex justify-center lg:justify-start items-center gap-2.5 px-3 py-2.5 w-full rounded-xl font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group text-sm"
          >
            <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" strokeWidth={1.5} />
            <span className="hidden lg:block text-sm">{t('Settings', 'Ρυθμίσεις')}</span>
          </button>
          
          {/* XP mini bar — visible on lg only */}
          <div className="hidden lg:block px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">XP</span>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{xp}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                style={{ width: `${Math.min(100, (xp % 1000) / 10)}%`, animation: 'progress-fill .8s ease-out' }}
              />
            </div>
          </div>

          <AuthUserMenu variant="sidebar" />
        </div>
      </aside>
      )}

      {/* Main Content */}
      <main id="main-content" className="flex-1 flex flex-col min-w-0 w-full max-w-none overflow-hidden relative mb-[120px] md:mb-0">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-50/50 dark:from-indigo-900/10 to-transparent pointer-events-none -z-10" />
        
        {/* Top Navbar */}
        {!isFocusMode && (
        <header className="h-16 flex items-center justify-between px-5 border-b border-slate-100/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl sticky top-0 z-10 transition-colors duration-300 no-print">
          <div className="md:hidden flex items-center gap-2">
            <div className="bg-slate-900 dark:bg-slate-800 p-1.5 rounded-lg shadow-md">
              <BrainCircuit className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-lg font-display font-bold tracking-tight text-slate-900 dark:text-white">
              Memora
            </h1>
            <div className="ml-2">
              <BatteryIndicator />
            </div>
          </div>
          
          <div className="hidden md:block flex-1 mr-4">
            <CommandPalette />
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="md:hidden">
              <CommandPalette />
            </div>
            
            <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 px-3 py-1.5 rounded-xl border border-amber-200/80 dark:border-amber-800/50 shadow-sm">
              <span className="text-xs font-bold text-amber-500 dark:text-amber-400">⚡</span>
              <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{xp} XP</span>
            </div>
            
            <div className="hidden sm:flex items-center gap-2 bg-sky-50 dark:bg-sky-900/20 px-3 py-1.5 rounded-xl border border-sky-200/80 dark:border-sky-800/50 shadow-sm" title={t('Streak Freezes', 'Πάγωμα Streak')}>
              <span className="text-sm">🧊</span>
              <span className="text-sm font-bold text-sky-700 dark:text-sky-300">{streakFreezes}</span>
            </div>

            <SyncIndicator />
            <AuthUserMenu />
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <Shield className="w-3.5 h-3.5 text-indigo-500" />
              <select 
                value={userRole}
                onChange={handleRoleChange}
                aria-label={t('Select user role', 'Επιλογή ρόλου')}
                className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
              >
                <option value="student">{t('Student', 'Μαθητής')}</option>
                <option value="instructor">{t('Instructor', 'Εκπαιδευτής')}</option>
                <option value="admin">{t('Admin', 'Διαχειριστής')}</option>
              </select>
            </div>
            <button 
              onClick={() => setIsShortcutsOpen(true)}
              aria-label={t('Keyboard Shortcuts', 'Συντομεύσεις Πληκτρολογίου')}
              className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm no-print"
            >
              <HelpCircle className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button 
              onClick={toggleDyslexiaFont}
              aria-label={isDyslexiaFont ? t('Switch to default font', 'Επιστροφή σε κανονική γραμματοσειρά') : t('Switch to dyslexic-friendly font', 'Εναλλαγή σε γραμματοσειρά δυσλεξίας')}
              className={cn("w-8 h-8 rounded-full border flex items-center justify-center transition-all shadow-sm no-print", 
                isDyslexiaFont 
                  ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600"
              )}
              title={t('Toggle Dyslexic Font', 'Εναλλαγή Γραμματοσειράς Δυσλεξίας')}
            >
              <Type className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button 
              onClick={toggleDarkMode}
              aria-label={isDarkMode ? t('Switch to light mode', 'Εναλλαγή σε φωτεινό θέμα') : t('Switch to dark mode', 'Εναλλαγή σε σκοτεινό θέμα')}
              className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm no-print"
            >
              {isDarkMode ? <Sun className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> : <Moon className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />}
            </button>
            <button 
              onClick={() => setIsActivityDrawerOpen(true)}
              aria-label={t('Activity and notifications', 'Δραστηριότητα & ειδοποιήσεις')}
              className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm no-print"
            >
              <Bell className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button 
              className="md:hidden w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 shadow-sm no-print" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={t('Open mobile menu', 'Άνοιγμα μενού')}
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="w-4 h-4" aria-hidden="true" />
            </button>
            <button 
              onClick={toggleFocusMode}
              aria-label={t('Enter Focus Mode', 'Λειτουργία Εστίασης')}
              className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all shadow-sm no-print"
              title={t('Enter Focus Mode', 'Λειτουργία Εστίασης')}
            >
              <BrainCircuit className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </header>
        )}
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div
            className={cn(
              'w-full min-w-0 max-w-none h-full relative',
              isFullBleedRoute(location.pathname)
                ? 'p-0'
                : cn(CONTENT_GUTTER, 'py-4 md:py-6 md:pb-24'),
            )}
          >
            {isFocusMode ? (
              <div className="flex flex-col items-center justify-center h-full w-full">
                <button 
                  onClick={toggleFocusMode}
                  className="fixed top-4 right-4 z-50 bg-slate-900 dark:bg-slate-800 text-white px-4 py-2 rounded-full shadow-xl hover:shadow-2xl transition-all flex items-center gap-2"
                >
                  {t('Exit Focus Mode', 'Έξοδος Εστίασης')}
                </button>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {!isFocusMode && (
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800/60 z-30 pb-safe no-print">
        <div className="flex items-center justify-around h-16 px-4">
          {[
            { name: t('Dashboard', 'Πίνακας'), path: '/', icon: LayoutDashboard },
            { name: t('Library', 'Βιβλιοθήκη'), path: '/library', icon: BookOpen },
            { name: t('Tasks', 'Εργασίες'), path: '/tasks', icon: CheckSquare },
            { name: t('Agent', 'Βοηθός'), path: '/agent', icon: MessageSquare },
          ].map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex flex-col items-center justify-center w-full h-full"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeBottomNavIndicator"
                    className="absolute inset-x-2 top-1.5 bottom-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl -z-10 border border-indigo-100 dark:border-indigo-800/40"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={cn('w-5 h-5 mb-1 transition-all duration-200', isActive ? 'text-indigo-600 dark:text-indigo-400 scale-110' : 'text-slate-500 dark:text-slate-400')} strokeWidth={isActive ? 2 : 1.5} />
                <span className={cn('text-xs font-semibold transition-colors', isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400')}>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      )}

      {/* Mobile Settings Drawer overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-2xl z-50 p-4 pb-8"
            >
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-3 px-4 py-3 w-full rounded-xl font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <Settings className="w-5 h-5" strokeWidth={1.5} />
                  <span>{t('Settings', 'Ρυθμίσεις')}</span>
                </button>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 mt-2">
                  <AuthUserMenu variant="sidebar" />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <ActivityDrawer isOpen={isActivityDrawerOpen} onClose={() => setIsActivityDrawerOpen(false)} />
      <FeedbackModal />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </div>
  );
}
