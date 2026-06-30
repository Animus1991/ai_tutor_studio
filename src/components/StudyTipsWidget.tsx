import { useState, useEffect } from 'react';
import { Lightbulb, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StudyTipsWidget() {
  const [tip, setTip] = useState('');
  const [urls, setUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTip = async () => {
      try {
        const response = await fetch('/api/study-tips');
        const data = await response.json();
        setTip(data.tip || "Failed to fetch tip.");
        setUrls(data.urls || []);
      } catch (e) {
        console.error(e);
        setTip("Could not load study tip at this time.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchTip();
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-amber-500 dark:text-amber-400" />
        </div>
        <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
          Daily Tip
        </h3>
      </div>
      
      {isLoading ? (
        <div className="animate-pulse flex flex-col gap-2">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
        </div>
      ) : (
        <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-3">
          <p>{tip}</p>
          {urls.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 mb-1 block">Sources:</span>
              <div className="flex flex-col gap-1">
                {urls.map((url, i) => (
                  <a 
                    key={i} 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {new URL(url).hostname}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
