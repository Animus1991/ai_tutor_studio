/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Agent from "./pages/Agent";
import RouteFallback from "./components/RouteFallback";

const Library = lazy(() => import("./pages/Library"));
const CollabRoom = lazy(() => import("./pages/CollabRoom"));
const Admin = lazy(() => import("./pages/Admin"));
const Workspace = lazy(() => import("./pages/Workspace"));
const StudyWorkspacePage = lazy(() => import("./pages/StudyWorkspacePage"));
const VoiceTutor = lazy(() => import("./pages/VoiceTutor"));
const Teacher = lazy(() => import("./pages/Teacher"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));
import ThemeProvider from "./components/ThemeProvider";
import TimerManager from "./components/TimerManager";
import AudioController from "./components/AudioController";
import { bootstrapAuth, googleSignIn, describeAuthError, isCancelledAuthError } from "./lib/auth";
import { useAuthStore } from "./store/useAuthStore";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { PwaInstallBanner } from "./components/PwaInstallBanner";
import { SearchProvider } from "./hooks/useSearch";
import { Toaster } from "sonner";
import QuickAddModal from "./components/QuickAddModal";
import PostSessionModal from "./components/PostSessionModal";
import DemoSandboxBanner from "./components/DemoSandboxBanner";
import { seedDemoSandbox, isDemoModeActive, ensureDemoSandboxReady } from "./lib/demoMode";
import LiveRegion from "./components/LiveRegion";
import { useLibraryStore } from "./store/useLibraryStore";
import { toast } from "sonner";
import Onboarding from "./components/Onboarding";
import { hasCompletedOnboarding } from "./lib/onboardingProfile";

export default function App() {
  const { needsAuth, setNeedsAuth, setUser, setAccessToken, enterDemoMode, isDemoMode } = useAuthStore();
  const hydrateLibrary = useLibraryStore((s) => s.hydrate);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isEnteringDemo, setIsEnteringDemo] = useState(false);
  const [authBootstrapping, setAuthBootstrapping] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    let unsubscribe = () => {};

    void bootstrapAuth({
      onRedirectSuccess: (session) => {
        void session.user.getIdToken().then((idToken) => {
          setUser(session.user);
          setAccessToken(idToken);
          setNeedsAuth(false);
          toast.success('Signed in with Google');
        });
      },
      onRedirectError: (err) => {
        if (isCancelledAuthError(err)) return;
        toast.error(describeAuthError(err));
      },
      onAuthSuccess: (user, token) => {
        setUser(user);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      onAuthFailure: () => {
        // Demo flag may live in storage before enterDemoMode() runs in .then()
        if (isDemoModeActive() || useAuthStore.getState().isDemoMode) return;
        setUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
      },
    }).then((unsub) => {
      unsubscribe = unsub;

      const wantsDemo = new URLSearchParams(window.location.search).get('demo') === '1';
      if (wantsDemo && !useAuthStore.getState().isDemoMode) {
        enterDemoMode();
      } else if (isDemoModeActive() && useAuthStore.getState().needsAuth) {
        enterDemoMode();
      } else if (isDemoModeActive()) {
        useAuthStore.setState({ isDemoMode: true, needsAuth: false });
      }

      if (useAuthStore.getState().isDemoMode || isDemoModeActive()) {
        void ensureDemoSandboxReady()
          .then(() => hydrateLibrary())
          .catch((err) => console.error('Demo sandbox failed:', err));
      }

      setAuthBootstrapping(false);
    });

    return () => unsubscribe();
  }, [enterDemoMode, setUser, setAccessToken, setNeedsAuth, hydrateLibrary]);

  // Check onboarding status after auth resolves (demo sandbox skips the wizard)
  useEffect(() => {
    if (needsAuth) return;
    if (isDemoMode || isDemoModeActive()) {
      setShowOnboarding(false);
      setOnboardingChecked(true);
      return;
    }
    hasCompletedOnboarding().then((completed) => {
      setShowOnboarding(!completed);
      setOnboardingChecked(true);
    });
  }, [needsAuth, isDemoMode]);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        if (result.accessToken) setAccessToken(result.accessToken);
        setNeedsAuth(false);
      }
      // null → redirect in progress on localhost
    } catch (err: unknown) {
      if (isCancelledAuthError(err)) return;
      console.error("Login failed:", err);
      toast.error(describeAuthError(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEnterDemo = async () => {
    setIsEnteringDemo(true);
    try {
      enterDemoMode();
      await seedDemoSandbox();
      await hydrateLibrary();
      toast.success('Demo sandbox loaded — explore without signing in');
    } catch (err) {
      console.error(err);
      toast.error('Failed to load demo content');
    } finally {
      setIsEnteringDemo(false);
    }
  };

  if (authBootstrapping) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading Memora…</p>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-900">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100 dark:border-slate-700"
        >
          <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">
            Memora
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Sign in to access your AI tutoring workspace, or try the demo locally without Firebase.
          </p>
          <button
            onClick={handleEnterDemo}
            disabled={isEnteringDemo}
            className="w-full mb-3 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-3 font-semibold transition-colors shadow-sm disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5" />
            {isEnteringDemo ? 'Loading demo…' : 'Try Demo Sandbox'}
          </button>
          <p className="text-xs text-slate-400 mb-4">No Google account required · full local experience</p>
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2 md:px-6 md:py-3 font-semibold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm disabled:opacity-50"
          >
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="w-6 h-6"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              ></path>
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              ></path>
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              ></path>
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              ></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
            {isLoggingIn ? "Signing in..." : "Sign in with Google"}
          </button>
        </motion.div>
      </div>
    );
  }

  if (!needsAuth && showOnboarding && onboardingChecked) {
    return (
      <ThemeProvider>
        <Onboarding onComplete={handleOnboardingComplete} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SearchProvider>
        <LiveRegion />
        <Toaster position="bottom-right" />
        <OfflineIndicator />
        <PwaInstallBanner />
        <QuickAddModal />
        <PostSessionModal />
        <div className="md:contents fixed bottom-16 left-0 right-0 z-40 flex items-center justify-between px-4 py-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-t border-slate-200 dark:border-slate-800 md:bg-transparent md:backdrop-blur-none md:border-none md:p-0 pointer-events-auto">
          <div className="md:contents"><AudioController /></div>
          <div className="md:contents"><TimerManager /></div>
        </div>
        <BrowserRouter>
          <DemoSandboxBanner />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="agent" element={<Agent />} />
              <Route
                path="library"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Library />
                  </Suspense>
                }
              />
              <Route
                path="collab"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <CollabRoom />
                  </Suspense>
                }
              />
              <Route
                path="workspace"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Workspace />
                  </Suspense>
                }
              />
              <Route
                path="study/:courseId"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <StudyWorkspacePage />
                  </Suspense>
                }
              />
              <Route
                path="voice"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <VoiceTutor />
                  </Suspense>
                }
              />
              <Route
                path="teacher"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Teacher />
                  </Suspense>
                }
              />
              <Route
                path="admin"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Admin />
                  </Suspense>
                }
              />
            </Route>
            <Route
              path="oauth/callback"
              element={
                <Suspense fallback={null}>
                  <OAuthCallback />
                </Suspense>
              }
            />
          </Routes>
        </BrowserRouter>
      </SearchProvider>
    </ThemeProvider>
  );
}
