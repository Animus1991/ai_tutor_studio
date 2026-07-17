import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, User as UserIcon, Loader2 } from "lucide-react";
import { login, register, forgotPassword, toFirebaseLikeUser, type AppUser } from "../lib/appAuth";

interface Props {
  onSuccess: (user: import("firebase/auth").User, appUser: AppUser) => void;
}

type Mode = "login" | "register";

export default function EmailAuthPanel({ onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const user = mode === "login" ? await login(email, password) : await register(email, password, name);
      onSuccess(toFirebaseLikeUser(user), user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email) {
      setError("Enter your email first, then tap ‘Forgot password’.");
      return;
    }
    await forgotPassword(email);
    setInfo("If that email exists, a reset link was generated (check server logs in preview).");
  };

  return (
    <form onSubmit={submit} className="space-y-3 text-left" data-testid="email-auth-form">
      {mode === "register" && (
        <div className="relative">
          <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="auth-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name (optional)"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}
      <div className="relative">
        <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          data-testid="auth-email-input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="relative">
        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          data-testid="auth-password-input"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 chars)"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-500" data-testid="auth-error">
          {error}
        </motion.p>
      )}
      {info && <p className="text-xs text-emerald-600" data-testid="auth-info">{info}</p>}

      <button
        data-testid="auth-submit-button"
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 font-semibold transition-colors shadow-sm disabled:opacity-50"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {mode === "login" ? "Sign in with Email" : "Create account"}
      </button>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <button
          type="button"
          data-testid="auth-toggle-mode"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
            setInfo(null);
          }}
          className="hover:text-indigo-600 transition-colors"
        >
          {mode === "login" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
        {mode === "login" && (
          <button type="button" onClick={handleForgot} className="hover:text-indigo-600 transition-colors" data-testid="auth-forgot">
            Forgot password?
          </button>
        )}
      </div>
    </form>
  );
}
