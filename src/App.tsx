/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Library from "./pages/Library";
import Tasks from "./pages/Tasks";
import Agent from "./pages/Agent";
import CollabRoom from "./pages/CollabRoom";
import Admin from "./pages/Admin";
import Workspace from "./pages/Workspace";
import ThemeProvider from "./components/ThemeProvider";
import TimerManager from "./components/TimerManager";
import AudioController from "./components/AudioController";
import { initAuth, googleSignIn } from "./lib/auth";
import { useAuthStore } from "./store/useAuthStore";
import { motion } from "framer-motion";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { SearchProvider } from "./hooks/useSearch";
import { Toaster } from "sonner";

export default function App() {
  const { needsAuth, setNeedsAuth, setUser, setAccessToken } = useAuthStore();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setUser(user);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
      },
    );
    return () => unsubscribe();
  }, [setUser, setAccessToken, setNeedsAuth]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error("Login failed:", err);
    } finally {
      setIsLoggingIn(false);
    }
  };

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
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            Sign in to access your AI tutoring workspace.
          </p>
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

  return (
    <ThemeProvider>
      <SearchProvider>
        <Toaster position="bottom-right" />
        <OfflineIndicator />
        <TimerManager />
        <AudioController />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="library" element={<Library />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="agent" element={<Agent />} />
              <Route path="collab" element={<CollabRoom />} />
              <Route path="workspace" element={<Workspace />} />
              <Route path="admin" element={<Admin />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SearchProvider>
    </ThemeProvider>
  );
}
