import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Loader2, Sparkles } from 'lucide-react';
import { generateImage } from '../lib/api';

export default function ImageGeneratorModal({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave?: (imageUrl: string, prompt: string) => void }) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    setImageUrl(null);
    try {
      const res = await generateImage(prompt);
      if (res.image) {
        setImageUrl(res.image);
      }
    } catch (error) {
      console.error('Failed to generate image', error);
      alert('Failed to generate image');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 max-w-2xl w-full border border-slate-200/60 dark:border-slate-800/60 relative overflow-hidden"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              &times;
            </button>
            <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" /> Generate Diagram
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
              Describe the educational diagram, concept map, or study aid you want to create.
            </p>
            
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <input 
                  autoFocus
                  required 
                  type="text" 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" 
                  placeholder="e.g. A minimalist infographic explaining the IS-LM model..." 
                />
              </div>
              <button 
                type="submit" 
                disabled={isLoading || !prompt.trim()}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Image className="w-5 h-5" />}
                Generate
              </button>
            </form>

            {imageUrl && (
              <div className="mt-6 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                <img src={imageUrl} alt={prompt} className="w-full object-contain max-h-[400px]" referrerPolicy="no-referrer" />
                {onSave && (
                  <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                    <button 
                      onClick={() => { onSave(imageUrl, prompt); onClose(); }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      Save to Metadata
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
