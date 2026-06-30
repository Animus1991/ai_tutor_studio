import { useState, useRef, useEffect } from 'react';
import { Music, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export default function AudioController() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<'lofi' | 'ambient'>('lofi');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // We would use actual URLs for these tracks, but we'll simulate it or use public domain placeholders
    const tracks = {
      lofi: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
      ambient: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=ambient-piano-amp-strings-10711.mp3'
    };

    if (audioRef.current) {
      audioRef.current.src = tracks[currentTrack];
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Audio play failed:", e));
      }
    }
  }, [currentTrack]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Audio play failed:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3 pointer-events-none">
      <audio ref={audioRef} loop />
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-2xl shadow-indigo-500/10 pointer-events-auto flex flex-col w-[240px]"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Focus Sounds
              </span>
            </div>

            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mb-4">
              <button
                onClick={() => setCurrentTrack('lofi')}
                className={cn(
                  "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                  currentTrack === 'lofi' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                Lo-fi Beats
              </button>
              <button
                onClick={() => setCurrentTrack('ambient')}
                className={cn(
                  "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                  currentTrack === 'ambient' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                Ambient
              </button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setIsMuted(!isMuted)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 cursor-pointer"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => {
          if (!isExpanded) setIsExpanded(true);
          else {
             setIsPlaying(!isPlaying);
             if(!isPlaying && !isExpanded) setIsExpanded(true);
          }
        }}
        onDoubleClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "h-14 rounded-2xl flex items-center gap-3 px-4 font-bold shadow-xl border pointer-events-auto transition-all",
          isPlaying 
            ? "bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/20" 
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
        )}
      >
        <Music className={cn("w-5 h-5", isPlaying ? "animate-pulse" : "")} />
        {isExpanded && (
          <span onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} className="ml-1 opacity-60 hover:opacity-100 p-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </span>
        )}
      </button>
    </div>
  );
}
