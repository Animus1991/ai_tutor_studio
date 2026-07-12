import { Sparkles, X, Upload } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

export default function DemoSandboxBanner() {
  const { isDemoMode, exitDemoMode } = useAuthStore();
  const navigate = useNavigate();

  if (!isDemoMode) return null;

  return (
    <div className="bg-indigo-600 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm z-50">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 shrink-0" />
        <span>
          <strong>Demo sandbox active</strong>
          <span className="hidden sm:inline"> — sample course & stats only. Sign in with Google for cloud sync.</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/library')}
          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold"
        >
          <Upload className="w-3.5 h-3.5" /> Upload material
        </button>
        <button
          onClick={() => { exitDemoMode(); navigate('/'); }}
          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold"
        >
          <X className="w-3.5 h-3.5" /> Exit demo
        </button>
      </div>
    </div>
  );
}
