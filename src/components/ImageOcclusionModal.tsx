import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Image as ImageIcon, Loader2, UploadCloud, Target } from "lucide-react";
import { toast } from "sonner";
import { auth, db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface ImageOcclusionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageOcclusionModal({ isOpen, onClose }: ImageOcclusionModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [labels, setLabels] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Please select an image file");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setLabels([]);
    }
  };

  const processImage = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const res = await fetch("/api/occlusion", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to process image");

      setLabels(data.labels || []);
      toast.success("AI identified labels successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to process image");
    } finally {
      setIsLoading(false);
    }
  };

  const saveFlashcards = async () => {
    const user = auth.currentUser;
    if (!user) {
        toast.error("You must be logged in");
        return;
    }
    
    if (labels.length === 0) return;
    
    try {
        const deckRef = await addDoc(collection(db, "users", user.uid, "decks"), {
            title: `Visual Notes: ${selectedFile?.name || "Image"}`,
            createdAt: serverTimestamp()
        });
        
        for (const label of labels) {
            await addDoc(collection(db, "users", user.uid, "flashcards"), {
                deckId: deckRef.id,
                front: `Identify the label: ${label.text} in the diagram.`, // Simplified for mock
                back: label.text,
                imageUrl: previewUrl, // Ideally uploaded to Storage
                box: label.box, // The occlusion box coordinates
                createdAt: serverTimestamp(),
                repetition: 0,
                interval: 1,
                easeFactor: 2.5,
                nextReviewDate: new Date().toISOString(),
                type: "occlusion"
            });
        }
        toast.success(`Created ${labels.length} visual flashcards!`);
        onClose();
    } catch (e: any) {
        toast.error("Failed to save flashcards");
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
            <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                    <Target className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-zinc-900 dark:text-white">AI Image Occlusion</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Upload a diagram or map. The AI will automatically identify labels and convert them into visual flashcards by hiding them (occlusion).
                </p>

                {!previewUrl ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <UploadCloud className="w-10 h-10 text-zinc-400 mb-3" />
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Click to upload image</p>
                    <p className="text-xs text-zinc-500 mt-1">PNG, JPG up to 5MB</p>
                  </div>
                ) : (
                  <div className="relative border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col items-center select-none">
                    <p className="text-xs text-zinc-500 mb-2 w-full text-center">Drag on the image to draw occlusion boxes manually, or use AI.</p>
                    <div className="relative inline-block"
                        onPointerDown={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const y = e.clientY - rect.top;
                          // @ts-ignore
                          e.currentTarget.dataset.startX = x;
                          // @ts-ignore
                          e.currentTarget.dataset.startY = y;
                          // @ts-ignore
                          e.currentTarget.dataset.drawing = "true";
                          
                          // create a temporary visual box
                          const box = document.createElement('div');
                          box.id = "temp-drawing-box";
                          box.className = "absolute border-2 border-dashed border-indigo-500 bg-indigo-500/20";
                          box.style.top = `${y}px`;
                          box.style.left = `${x}px`;
                          box.style.width = '0px';
                          box.style.height = '0px';
                          box.style.pointerEvents = 'none';
                          e.currentTarget.appendChild(box);
                        }}
                        onPointerMove={(e) => {
                          if (e.currentTarget.dataset.drawing === "true") {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const y = e.clientY - rect.top;
                            const startX = parseFloat(e.currentTarget.dataset.startX || "0");
                            const startY = parseFloat(e.currentTarget.dataset.startY || "0");
                            
                            const top = Math.min(startY, y);
                            const left = Math.min(startX, x);
                            const height = Math.abs(y - startY);
                            const width = Math.abs(x - startX);
                            
                            const box = document.getElementById("temp-drawing-box");
                            if (box) {
                              box.style.top = `${top}px`;
                              box.style.left = `${left}px`;
                              box.style.width = `${width}px`;
                              box.style.height = `${height}px`;
                            }
                          }
                        }}
                        onPointerUp={(e) => {
                          if (e.currentTarget.dataset.drawing === "true") {
                            e.currentTarget.dataset.drawing = "false";
                            const box = document.getElementById("temp-drawing-box");
                            if (box) {
                                const top = parseFloat(box.style.top);
                                const left = parseFloat(box.style.left);
                                const height = parseFloat(box.style.height);
                                const width = parseFloat(box.style.width);
                                box.remove();
                                
                                if (height > 10 && width > 10) {
                                  const text = prompt("Enter label for this occluded area:");
                                  if (text) {
                                    setLabels(prev => [...prev, { text, box: [top, left, top + height, left + width] }]);
                                  }
                                }
                            }
                          }
                        }}
                    >
                        <img src={previewUrl} alt="Preview" className="max-h-[400px] rounded-lg object-contain pointer-events-none" />
                        {labels.map((l, i) => (
                            <div key={i} className="absolute border-2 border-indigo-500 bg-indigo-500/20 backdrop-blur-sm group" 
                                style={{
                                    top: `${l.box[0]}px`, left: `${l.box[1]}px`,
                                    height: `${l.box[2] - l.box[0]}px`, width: `${l.box[3] - l.box[1]}px`
                                }}
                            >
                                <span className="absolute -top-6 bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                    {l.text}
                                </span>
                                <button
                                    onClick={() => setLabels(prev => prev.filter((_, idx) => idx !== i))}
                                    className="absolute -right-2 -top-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                />

                <div className="flex gap-3 pt-2">
                    {previewUrl && labels.length === 0 && (
                        <button
                            onClick={processImage}
                            disabled={isLoading}
                            className="flex-1 py-2.5 px-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing Image...</>
                            ) : (
                                "Identify Labels via AI"
                            )}
                        </button>
                    )}
                    {labels.length > 0 && (
                        <button
                            onClick={saveFlashcards}
                            className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            Save {labels.length} Flashcards
                        </button>
                    )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
