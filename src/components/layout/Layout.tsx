import { Outlet, Link, useLocation } from 'react-router-dom';
import { BookOpen, CheckSquare, MessageSquare, Settings, BrainCircuit, Bell, User as UserIcon, Sun, Moon, Menu, Users, Shield, LayoutDashboard } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { useAuthStore, Role } from '../../store/useAuthStore';
import { auditLogger } from '../../lib/auditLogger';
import { useState, useEffect } from 'react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import CommandPalette from '../CommandPalette';
import SyncIndicator from '../SyncIndicator';
import ActivityDrawer from '../ActivityDrawer';
import FeedbackModal from '../FeedbackModal';
import SettingsModal from '../SettingsModal';
import { toast } from 'sonner';

export default function Layout() {
  useKeyboardShortcuts();
  const location = useLocation();
  const { isDarkMode, toggleDarkMode, isFocusMode, toggleFocusMode } = useStore();
  const { userRole, setUserRole } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Simulate upcoming task / streak notifications
    const timeout = setTimeout(() => {
      toast("System Update: Background sync is now enabled.");
    }, 5000);

    const taskTimeout = setTimeout(() => {
      toast.info("Upcoming Task: 'Review Math Concepts' is due in 30 minutes.");
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
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Library', path: '/library', icon: BookOpen },
    { name: 'Tasks', path: '/tasks', icon: CheckSquare },
    { name: 'Agent', path: '/agent', icon: MessageSquare },
    { name: 'Collab Space', path: '/collab', icon: Users },
  ];

  if (userRole === 'admin' || userRole === 'instructor') {
    navItems.push({ name: 'Admin Dashboard', path: '/admin', icon: Settings });
  }

  return (
    <div className="flex h-screen bg-[#FAFAFA] dark:bg-[#020617] text-slate-900 dark:text-slate-50 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/50 selection:text-indigo-900 dark:selection:text-indigo-100 transition-colors duration-300">
      {/* Sidebar (Desktop) */}
      {!isFocusMode && (
        <aside className="hidden md:flex w-16 lg:w-56 bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800/60 flex-col transition-all duration-300 relative z-20">
          <div className="h-16 flex items-center justify-center lg:justify-start lg:px-5 border-b border-slate-100/50 dark:border-slate-800/50">
          <div className="relative group flex items-center gap-2 cursor-pointer">
            <div className="bg-slate-900 dark:bg-slate-800 p-1.5 rounded-xl shadow-sm group-hover:shadow-indigo-500/20 transition-all">
              <BrainCircuit className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="hidden lg:block text-lg font-display font-bold tracking-tight text-slate-900 dark:text-white">
              Memora
            </h1>
          </div>
        </div>
        
        <nav aria-label="Main Navigation" className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex items-center lg:px-3 py-2 justify-center lg:justify-start rounded-xl font-medium transition-all duration-200 group text-sm"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute inset-0 bg-slate-900 dark:bg-indigo-600 rounded-xl"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <div className={cn("relative z-10 flex items-center justify-between w-full gap-2", isActive ? "text-white" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white")}>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" strokeWidth={isActive ? 2 : 1.5} />
                    <span className="hidden lg:block">{item.name}</span>
                  </div>
                  {index < 4 && (
                    <span className={cn(
                      "hidden lg:block text-[10px] px-1 py-0.5 rounded font-mono border",
                      isActive 
                        ? "bg-slate-800/50 border-slate-700/50 text-slate-300" 
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                    )}>
                      ⌥{index + 1}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-slate-100/50 dark:border-slate-800/50 space-y-1">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex justify-center lg:justify-start items-center gap-2 px-3 py-2 w-full rounded-xl font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group text-sm"
          >
            <Settings className="w-4 h-4" strokeWidth={1.5} />
            <span className="hidden lg:block">Settings</span>
          </button>
          
          <div className="mt-1 flex items-center justify-center lg:justify-start gap-2 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700/50">
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 shrink-0">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="hidden lg:block overflow-hidden">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">Alex Learner</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Pro Plan</p>
            </div>
          </div>
        </div>
      </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative mb-16 md:mb-0">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-50/50 dark:from-indigo-900/10 to-transparent pointer-events-none -z-10" />
        
        {/* Top Navbar */}
        {!isFocusMode && (
        <header className="h-14 flex items-center justify-between px-4 border-b border-slate-100/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 transition-colors duration-300">
          <div className="md:hidden flex items-center gap-2">
            <div className="bg-slate-900 dark:bg-slate-800 p-1.5 rounded-lg shadow-md">
              <BrainCircuit className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-lg font-display font-bold tracking-tight text-slate-900 dark:text-white">
              Memora
            </h1>
          </div>
          
          <div className="hidden md:block flex-1 mr-4">
            <CommandPalette />
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="md:hidden">
              <CommandPalette />
            </div>
            <SyncIndicator />
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <Shield className="w-3.5 h-3.5 text-indigo-500" />
              <select 
                value={userRole}
                onChange={handleRoleChange}
                aria-label="Select user role"
                className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
              >
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button 
              onClick={toggleDarkMode}
              aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm"
            >
              {isDarkMode ? <Sun className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> : <Moon className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />}
            </button>
            <button 
              onClick={() => setIsActivityDrawerOpen(true)}
              aria-label="Activity and notifications"
              className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm"
            >
              <Bell className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button 
              className="md:hidden w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 shadow-sm" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Open mobile menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="w-4 h-4" aria-hidden="true" />
            </button>
            <button 
              onClick={toggleFocusMode}
              aria-label="Enter Focus Mode"
              className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all shadow-sm"
              title="Enter Focus Mode"
            >
              <BrainCircuit className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </header>
        )}
        
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 md:p-8 h-full relative">
            {isFocusMode && (
              <button 
                onClick={toggleFocusMode}
                className="fixed top-4 right-4 z-50 bg-slate-900 dark:bg-slate-800 text-white px-4 py-2 rounded-full shadow-xl hover:shadow-2xl transition-all flex items-center gap-2"
              >
                Exit Focus Mode
              </button>
            )}
            <Outlet />
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {!isFocusMode && (
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800/60 z-30 pb-safe">
        <div className="flex items-center justify-around h-16 px-4">
          {navItems.map((item) => {
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
                    className="absolute inset-x-4 top-1 bottom-1 bg-slate-100 dark:bg-slate-800 rounded-xl -z-10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={cn("w-5 h-5 mb-1 transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400")} strokeWidth={isActive ? 2 : 1.5} />
                <span className={cn("text-[10px] font-medium transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400")}>{item.name}</span>
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
                  <span>Settings</span>
                </button>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 mt-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">Alex Learner</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Pro Plan</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <ActivityDrawer isOpen={isActivityDrawerOpen} onClose={() => setIsActivityDrawerOpen(false)} />
      <FeedbackModal />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
