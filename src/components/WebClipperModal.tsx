import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Globe, Link as LinkIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { auth, db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface WebClipperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WebClipperModal({ isOpen, onClose }: WebClipperModalProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleClip = async () => {
    if (!url.trim()) {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsLoading(true);
    try {
      // Fetch article content
      const res = await fetch("/api/clipper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to clip article");

      const user = auth.currentUser;
      if (user) {
        // Save as a document
        await addDoc(collection(db, "users", user.uid, "documents"), {
          title: data.title,
          content: data.content,
          createdAt: serverTimestamp(),
          sourceUrl: url,
        });
        
        // Generate flashcards from clipped content
        toast.info("Article clipped! Generating flashcards in background...");
        fetch("/api/generate-flashcards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: data.content }),
        }).then(r => r.json()).then(async (fcData) => {
            if (fcData.flashcards && fcData.flashcards.length > 0) {
                // Add flashcards to a new deck
                const deckRef = await addDoc(collection(db, "users", user.uid, "decks"), {
                    title: `Clipped: ${data.title}`,
                    createdAt: serverTimestamp()
                });
                
                for (const card of fcData.flashcards) {
                    await addDoc(collection(db, "users", user.uid, "flashcards"), {
                        deckId: deckRef.id,
                        front: card.question,
                        back: card.answer,
                        createdAt: serverTimestamp(),
                        repetition: 0,
                        interval: 1,
                        easeFactor: 2.5,
                        nextReviewDate: new Date().toISOString()
                    });
                }
                toast.success("Generated flashcards from clipped article!");
            }
        }).catch(err => {
            console.error("Failed to generate flashcards from clip", err);
        });

      } else {
        toast.success("Clipped: " + data.title);
      }

      onClose();
      setUrl("");
    } catch (error: any) {
      toast.error(error.message || "Failed to clip article");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl overflow-hidden pointer-events-auto">
              <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-zinc-900 dark:text-white">Web Clipper</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Paste a URL to an article or webpage. The AI will extract its content, save it to your library, and automatically generate flashcards for you.
                </p>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Article URL
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://en.wikipedia.org/wiki/Spaced_repetition"
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white placeholder:text-zinc-400"
                    />
                  </div>
                </div>

                <button
                  onClick={handleClip}
                  disabled={isLoading || !url.trim()}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Clipping and parsing...
                    </>
                  ) : (
                    <>
                      Clip to Library
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
