import { Outlet, Link, useLocation } from 'react-router-dom';
import { BookOpen, CheckSquare, MessageSquare, Settings, BrainCircuit, Bell, Menu, Users, Shield, LayoutDashboard, Calendar as CalendarIcon, HelpCircle, Type, Sparkles, Upload, Zap, Sun, Moon, Mic, GraduationCap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { useAuthStore, Role } from '../../store/useAuthStore';
import { auditLogger } from '../../lib/auditLogger';
import { useState, useEffect } from 'react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useStudyReminders } from '../../hooks/useStudyReminders';
import { usePageEngagement } from '../../hooks/usePageEngagement';
import CommandPalette from '../CommandPalette';
import SyncIndicator from '../SyncIndicator';
import ActivityDrawer from '../ActivityDrawer';
import FeedbackModal from '../FeedbackModal';
import SettingsModal from '../SettingsModal';
import ShortcutsModal from '../ShortcutsModal';
import BatteryIndicator from '../BatteryIndicator';
import { toast } from 'sonner';
import { isFullBleedRoute, CONTENT_GUTTER, MOBILE_TAB_CLEARANCE } from './pageLayout';
import SkipLink from '../SkipLink';
import { useLanguage } from '../../lib/i18n';
import AuthUserMenu from '../AuthUserMenu';

export default function Layout() {
  useKeyboardShortcuts();
  useStudyReminders();
  usePageEngagement();
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

  // Close mobile drawer on navigation / resize to desktop
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onResize = () => {
      if (window.matchMedia('(min-width: 768px)').matches) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    { name: t('Voice Tutor', 'Φωνητικός Βοηθός'), subtitle: t('Speak with Memora', 'Μίλα με τον Memora'), path: '/voice', icon: Mic },
    { name: t('Collab Space', 'Συνεργασία'), subtitle: t('Work with peers', 'Συνεργασία'), path: '/collab', icon: Users },
    { name: t('Workspace', 'Χώρος Εργασίας'), subtitle: t('Deep study tools', 'Εργαλεία μελέτης'), path: '/workspace', icon: CalendarIcon },
  ];

  const quickActions = [
    { label: t('Upload Material', 'Ανέβασε Υλικό'), icon: Upload, color: 'text-emerald-500', bg: 'bg-emerald-500/10', path: '/library' },
    { label: t('Quick Quiz', 'Γρήγορο Quiz'), icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10', path: '/agent' },
    { label: t('AI Agent', 'Βοηθός AI'), icon: Sparkles, color: 'text-indigo-500', bg: 'bg-indigo-500/10', path: '/agent' },
  ];

  if (userRole === 'admin' || userRole === 'instructor') {
    navItems.push({ name: t('Teacher Dashboard', 'Πίνακας Εκπαιδευτικού'), subtitle: t('Class roster & mastery', 'Τάξεις & πρόοδος'), path: '/teacher', icon: GraduationCap });
    navItems.push({ name: t('Admin Dashboard', 'Διαχείριση'), subtitle: t('Manage platform', 'Διαχείριση'), path: '/admin', icon: Settings });
  }

  return (
    <div className="flex h-dvh max-h-dvh w-full min-w-0 overflow-hidden bg-[#FAFAFA] dark:bg-[#020617] text-slate-900 dark:text-slate-50 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/50 selection:text-indigo-900 dark:selection:text-indigo-100 transition-colors duration-300">
      <SkipLink />
      {/* Sidebar — icon rail on tablet, labeled on desktop */}
      {!isFocusMode && (
        <aside className="hidden md:flex w-[4.5rem] lg:w-60 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800/60 flex-col transition-all duration-300 relative z-20 no-print">
          <div className="h-[var(--app-header-h)] flex items-center justify-center lg:justify-start lg:px-5 border-b border-slate-100/50 dark:border-slate-800/50">
          <div className="relative group flex items-center gap-2.5 cursor-pointer">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-1.5 rounded-xl shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/30 transition-all">
              <BrainCircuit className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <span className="hidden lg:block text-lg font-display font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Memora
            </span>
          </div>
        </div>
        
        <nav aria-label="Main Navigation" className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto min-h-0 scrollbar-hover">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                title={item.name}
                className="relative flex items-center lg:px-3 py-2.5 min-h-11 justify-center lg:justify-start rounded-xl font-medium transition-all duration-200 group text-sm touch-manipulation"
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
      <main id="main-content" className="flex-1 flex flex-col min-w-0 w-full max-w-none overflow-hidden relative">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-50/50 dark:from-indigo-900/10 to-transparent pointer-events-none -z-10" />
        
        {/* Top Navbar */}
        {!isFocusMode && (
        <header className="h-[var(--app-header-h)] pt-safe flex items-center justify-between gap-2 px-3 sm:px-4 md:px-5 border-b border-slate-100/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-20 transition-colors duration-300 no-print">
          <div className="md:hidden flex items-center gap-2 min-w-0">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-1.5 rounded-xl shadow-md shadow-indigo-500/20 shrink-0">
              <BrainCircuit className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-base font-display font-bold tracking-tight text-slate-900 dark:text-white truncate">
              Memora
            </h1>
            <div className="hidden xs:block shrink-0">
              <BatteryIndicator />
            </div>
          </div>
          
          <div className="hidden md:block flex-1 min-w-0 mr-3">
            <CommandPalette />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 shrink-0">
            <div className="md:hidden">
              <CommandPalette />
            </div>
            
            <div className="hidden lg:flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 px-3 py-1.5 rounded-xl border border-amber-200/80 dark:border-amber-800/50 shadow-sm">
              <span className="text-xs font-bold text-amber-500 dark:text-amber-400">⚡</span>
              <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{xp} XP</span>
            </div>
            
            <div className="hidden lg:flex items-center gap-2 bg-sky-50 dark:bg-sky-900/20 px-3 py-1.5 rounded-xl border border-sky-200/80 dark:border-sky-800/50 shadow-sm" title={t('Streak Freezes', 'Πάγωμα Streak')}>
              <span className="text-sm">🧊</span>
              <span className="text-sm font-bold text-sky-700 dark:text-sky-300">{streakFreezes}</span>
            </div>

            <SyncIndicator />
            <div className="hidden sm:block">
              <AuthUserMenu />
            </div>
            <div className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
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
              className="hidden md:flex touch-target w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm no-print"
            >
              <HelpCircle className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button 
              onClick={toggleDyslexiaFont}
              aria-label={isDyslexiaFont ? t('Switch to default font', 'Επιστροφή σε κανονική γραμματοσειρά') : t('Switch to dyslexic-friendly font', 'Εναλλαγή σε γραμματοσειρά δυσλεξίας')}
              className={cn("hidden sm:flex touch-target w-10 h-10 rounded-full border items-center justify-center transition-all shadow-sm no-print", 
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
              className="touch-target w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm no-print"
            >
              {isDarkMode ? <Sun className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> : <Moon className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />}
            </button>
            <button 
              onClick={() => setIsActivityDrawerOpen(true)}
              aria-label={t('Activity and notifications', 'Δραστηριότητα & ειδοποιήσεις')}
              className="touch-target w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm no-print"
            >
              <Bell className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button 
              className="md:hidden touch-target w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 shadow-sm no-print" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={t('Open mobile menu', 'Άνοιγμα μενού')}
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="w-4 h-4" aria-hidden="true" />
            </button>
            <button 
              onClick={toggleFocusMode}
              aria-label={t('Enter Focus Mode', 'Λειτουργία Εστίασης')}
              className="hidden sm:flex touch-target w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 items-center justify-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all shadow-sm no-print"
              title={t('Enter Focus Mode', 'Λειτουργία Εστίασης')}
            >
              <BrainCircuit className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </header>
        )}
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          <div
            className={cn(
              'w-full min-w-0 max-w-none relative',
              isFullBleedRoute(location.pathname)
                ? 'p-0 h-full min-h-0'
                : cn(CONTENT_GUTTER, 'py-3 sm:py-4 md:py-6', MOBILE_TAB_CLEARANCE),
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

      {/* Mobile / narrow-tablet bottom navigation */}
      {!isFocusMode && (
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/70 dark:border-slate-800/70 pb-safe no-print shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        <div className="flex items-stretch justify-around min-h-[var(--mobile-tab-h)] px-1 pt-1">
          {[
            { name: t('Home', 'Αρχική'), path: '/', icon: LayoutDashboard },
            { name: t('Library', 'Βιβλιοθήκη'), path: '/library', icon: BookOpen },
            { name: t('Voice', 'Φωνή'), path: '/voice', icon: Mic },
            { name: t('Agent', 'Βοηθός'), path: '/agent', icon: MessageSquare },
            { name: t('More', 'Άλλα'), path: '__more__', icon: Menu },
          ].map((item) => {
            const isMore = item.path === '__more__';
            const isActive = isMore
              ? isMobileMenuOpen || ['/collab', '/workspace', '/teacher', '/admin', '/tasks'].includes(location.pathname)
              : location.pathname === item.path;
            const Icon = item.icon;
            const tabClass = 'relative flex flex-col items-center justify-center w-full min-h-[48px] touch-manipulation select-none';

            if (isMore) {
              return (
                <button
                  key="more"
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label={t('More pages', 'Περισσότερες σελίδες')}
                  aria-expanded={isMobileMenuOpen}
                  className={tabClass}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeBottomNavIndicator"
                      className="absolute inset-x-1 top-1 bottom-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl -z-10 border border-indigo-100 dark:border-indigo-800/40"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon className={cn('w-5 h-5 mb-0.5 transition-all duration-200', isActive ? 'text-indigo-600 dark:text-indigo-400 scale-110' : 'text-slate-500 dark:text-slate-400')} strokeWidth={isActive ? 2 : 1.5} />
                  <span className={cn('text-[10px] font-semibold transition-colors leading-none', isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400')}>{item.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={tabClass}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeBottomNavIndicator"
                    className="absolute inset-x-1 top-1 bottom-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl -z-10 border border-indigo-100 dark:border-indigo-800/40"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={cn('w-5 h-5 mb-0.5 transition-all duration-200', isActive ? 'text-indigo-600 dark:text-indigo-400 scale-110' : 'text-slate-500 dark:text-slate-400')} strokeWidth={isActive ? 2 : 1.5} />
                <span className={cn('text-[10px] font-semibold transition-colors leading-none', isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400')}>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      )}

      {/* Mobile More drawer — full nav + role switcher */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/30 dark:bg-black/50 z-40 backdrop-blur-[2px]"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="md:hidden fixed bottom-0 left-0 right-0 max-h-[min(85dvh,640px)] overflow-y-auto overscroll-contain bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl z-50 px-3 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-[0_-12px_40px_rgba(0,0,0,0.12)]"
              role="dialog"
              aria-modal="true"
              aria-label={t('More pages', 'Περισσότερες σελίδες')}
            >
              <div className="flex justify-center py-2" aria-hidden="true">
                <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {t('All pages', 'Όλες οι σελίδες')}
                </p>
                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3.5 py-3.5 min-h-[52px] w-full rounded-2xl font-medium transition-colors touch-manipulation',
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800',
                        )}
                      >
                        <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                        <span className="flex-1 text-left text-sm leading-tight">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
                <button 
                  onClick={() => { setIsSettingsOpen(true); setIsMobileMenuOpen(false); }}
                  className="flex items-center gap-3 px-3.5 py-3.5 min-h-[52px] w-full rounded-2xl font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors touch-manipulation mt-1"
                >
                  <Settings className="w-5 h-5" strokeWidth={1.5} />
                  <span>{t('Settings', 'Ρυθμίσεις')}</span>
                </button>
                <div className="flex items-center gap-2 px-3.5 py-3 mt-1 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                  <Shield className="w-4 h-4 text-indigo-500 shrink-0" />
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">{t('Role', 'Ρόλος')}</label>
                  <select
                    value={userRole}
                    onChange={handleRoleChange}
                    aria-label={t('Select user role', 'Επιλογή ρόλου')}
                    className="flex-1 bg-transparent text-sm font-medium text-slate-700 dark:text-slate-300 outline-none min-h-10"
                  >
                    <option value="student">{t('Student', 'Μαθητής')}</option>
                    <option value="instructor">{t('Instructor', 'Εκπαιδευτής')}</option>
                    <option value="admin">{t('Admin', 'Διαχειριστής')}</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 mt-1">
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
