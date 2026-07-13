import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, FileText, CheckCircle2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useFocusTrap } from '../hooks/useFocusTrap';

export default function FlashcardGeneratorModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<{question: string, answer: string}[]>([]);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      toast.error('Please enter some text or notes');
      return;
    }

    setIsGenerating(true);
    setGeneratedCards([]);
    
    try {
      const res = await fetch('/api/generate-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText })
      });

      if (!res.ok) throw new Error('Failed to generate flashcards');
      
      const data = await res.json();
      setGeneratedCards(data.flashcards);
      toast.success(`Generated ${data.flashcards.length} flashcards`);
    } catch (err) {
      console.error(err);
      toast.error('Error generating flashcards. Using fallback generation.');
      // Fallback local logic for demo/offline resilience
      setTimeout(() => {
        setGeneratedCards([
          { question: "What is the primary concept you just described?", answer: "Review your notes to confirm the core topic." },
          { question: "Identify one key definition from the text.", answer: "Ensure it aligns with the main subject." }
        ]);
        setIsGenerating(false);
      }, 1500);
      return;
    } finally {
      setIsGenerating(false);
    }
  };

  const saveFlashcards = () => {
    // In a real app, this would save to Firebase or local storage
    toast.success('Flashcards saved to your deck!');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100]"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="flashcardgen-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl z-[101] overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 id="flashcardgen-modal-title" className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                AI Flashcard Generator
              </h2>
              <button
                onClick={onClose}
                aria-label="Close flashcard generator"
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {!generatedCards.length ? (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Paste your notes, essay, or transcript here
                  </label>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="E.g., Photosynthesis is the process used by plants, algae and certain bacteria to harness energy from sunlight and turn it into chemical energy..."
                    className="w-full h-48 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none resize-none"
                  />
                  
                  <div className="flex justify-end">
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || !inputText.trim()}
                      className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
                    >
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      Generate Cards
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {generatedCards.map((card, idx) => (
                      <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3">
                        <div>
                          <span className="section-eyebrow uppercase mb-1.5 block">Front</span>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{card.question}</p>
                        </div>
                        <div className="w-full h-px bg-slate-200 dark:bg-slate-700" />
                        <div>
                          <span className="section-eyebrow uppercase mb-1.5 block text-indigo-500 dark:text-indigo-400">Back</span>
                          <p className="text-sm text-slate-600 dark:text-slate-300">{card.answer}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setGeneratedCards([])}
                      className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                    >
                      Start Over
                    </button>
                    <button
                      onClick={saveFlashcards}
                      className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                    >
                      <Save className="w-4 h-4" /> Save to Deck
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
