import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Document, Page, pdfjs } from "react-pdf";
import {
  Upload,
  X,
  Save,
  FileText,
  Highlighter,
  MessageSquarePlus,
  Volume2,
  Image as ImageIcon,
  ShieldAlert,
  Presentation,
  BrainCircuit,
  Settings2,
  Type,
  BookOpen,
  Mic
} from "lucide-react";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import KnowledgeGraph from "./KnowledgeGraph";
import NotesEditor from "./NotesEditor";
import ImageGeneratorModal from "./ImageGeneratorModal";
import { useDictation } from "../hooks/useDictation";
import { detectAndSanitizePii } from "../lib/piiSanitizer";
import { analyzeSourceQuality, extractGlossary } from "../utils/nlp";
import { SourceAnalysis } from "./SourceAnalysis";
import { auditLogger } from "../lib/auditLogger";
import { useAuthStore } from "../store/useAuthStore";
import { useStore } from "../store/useStore";
import { useYjsText, globalCrdtStore } from "../lib/crdt";
import { useDocumentStore } from "../store/useDocumentStore";
import { useMasteryStore } from "../store/useMasteryStore";
import { useOntologyStore } from "../store/useOntologyStore";
import { xapi } from "../lib/xapiTracker";
import { initializeFSRS, reviewFSRS, FSRSData, FSRSRating } from "../lib/fsrs";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Annotation {
  id: string;
  type: "highlight" | "note";
  text: string;
  page: number;
  note?: string;
  createdAt: number;
}

export default function DocumentWorkspace({
  onClose,
}: {
  onClose?: () => void;
}) {
  const { userRole } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  
  const {
    pageNumber, setPageNumber,
    metadata, setMetadata,
    _hasHydrated: isNotesLoaded
  } = useDocumentStore();
  
  const [notes, setNotes] = useYjsText('workspace-notes', "<p>Start your notes here...</p>");

  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isNoteInputOpen, setIsNoteInputOpen] = useState(false);
  const [tempNote, setTempNote] = useState("");
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [piiWarning, setPiiWarning] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState<string>("");
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [flashcards, setFlashcards] = useState<{question: string, answer: string, fsrs?: FSRSData}[]>([]);
  const { addFlashcardReview, updateFeynmanScore } = useMasteryStore();
  
  const handleReviewFlashcard = (index: number, rating: FSRSRating) => {
    addFlashcardReview();
    setFlashcards(prev => {
      const newCards = [...prev];
      const card = newCards[index];
      
      const currentFSRS = card.fsrs || initializeFSRS();
      const updatedFSRS = reviewFSRS(currentFSRS, rating);

      newCards[index] = {
        ...card,
        fsrs: updatedFSRS
      };
      return newCards;
    });
  };
  const [summary, setSummary] = useState<string | null>(null);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [sourceMetrics, setSourceMetrics] = useState<ReturnType<typeof analyzeSourceQuality> | null>(null);
  const [glossary, setGlossary] = useState<{term: string, count: number}[]>([]);
  const [showGlossary, setShowGlossary] = useState(false);
  const [glossaryDefinition, setGlossaryDefinition] = useState<{term: string, definition: string, loading: boolean} | null>(null);

  const handleGetDefinition = async (term: string) => {
    setGlossaryDefinition({ term, definition: '', loading: true });
    try {
      const source = notes.replace(/<[^>]*>?/gm, '');
      const response = await fetch('/api/agent/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: source, 
          query: `Define the term "${term}" based on the context of the provided text. Keep it brief and clear.` 
        })
      });
      const data = await response.json();
      setGlossaryDefinition({ term, definition: data.text, loading: false });
    } catch (e) {
      console.error(e);
      setGlossaryDefinition({ term, definition: 'Failed to load definition.', loading: false });
    }
  };

  const [activeTab, setActiveTab] = useState<'notes' | 'flashcards' | 'agent' | 'feynman'>('notes');
  
  const isFeynmanMode = useStore(state => state.isFeynmanMode);
  const toggleFeynmanMode = useStore(state => state.toggleFeynmanMode);
  
  useEffect(() => {
    if (isFeynmanMode && activeTab !== 'feynman') {
      setActiveTab('feynman');
    } else if (!isFeynmanMode && activeTab === 'feynman') {
      setActiveTab('notes');
    }
  }, [isFeynmanMode]);

  useEffect(() => {
    if (activeTab === 'feynman' && !isFeynmanMode) {
      toggleFeynmanMode();
    } else if (activeTab !== 'feynman' && isFeynmanMode) {
      toggleFeynmanMode();
    }
  }, [activeTab]);
  const isBionicReading = useStore(state => state.isBionicReading);
  const toggleBionicReading = useStore(state => state.toggleBionicReading);
  const isDyslexiaFont = useStore(state => state.isDyslexiaFont);
  const toggleDyslexiaFont = useStore(state => state.toggleDyslexiaFont);
  const isTTSActive = useStore(state => state.isTTSActive);
  const toggleTTS = useStore(state => state.toggleTTS);
  
  const [isReaderSettingsOpen, setIsReaderSettingsOpen] = useState(false);
  const addOntologyData = useOntologyStore(state => state.addOntologyData);
  const [agentQuery, setAgentQuery] = useState("");
  const [agentResponse, setAgentResponse] = useState("");
  const [isAskingAgent, setIsAskingAgent] = useState(false);
  
  const { isDictating: isAgentDictating, transcript: agentTranscript, toggleDictation: toggleAgentDictation } = useDictation();

  useEffect(() => {
    if (activeTab === 'agent' && isAgentDictating) {
      setAgentQuery(agentTranscript);
    }
  }, [agentTranscript, isAgentDictating, activeTab]);

  const handleAskAgent = async () => {
    if (!agentQuery.trim()) return;
    setIsAskingAgent(true);
    try {
      const source = notes.replace(/<[^>]*>?/gm, '');
      const { BM25, createDocumentChunks } = await import('../lib/bm25');
      const chunks = createDocumentChunks(source);
      let context = "";
      
      if (chunks.length > 5) {
        const bm25 = new BM25(chunks);
        const topChunks = bm25.search(agentQuery, 3);
        context = "Current Notes:\n" + topChunks.map(c => `[Chunk ${c.index + 1}]: ${c.chunk}`).join('\n\n');
      } else {
        context = "Current Notes:\n" + chunks.map((c, i) => `[Chunk ${i + 1}]: ${c}`).join('\n\n');
      }

      try {
        const { searchVectors } = await import('../lib/vectorStore');
        const vectorResults = await searchVectors(agentQuery, 4);
        if (vectorResults && vectorResults.length > 0) {
          context += "\n\nRelevant Context from Other Documents:\n" + vectorResults.map((r) => `[Source: ${r.docTitle}]\n${r.text}`).join('\n\n');
        }
      } catch (err) {
        console.error("Vector search failed", err);
      }

      const response = await fetch('/api/agent/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, query: agentQuery })
      });
      const data = await response.json();
      setAgentResponse(data.text);
    } catch (e) {
      console.error(e);
      alert('Failed to ask agent');
    } finally {
      setIsAskingAgent(false);
    }
  };
  const [isCheckingFeynman, setIsCheckingFeynman] = useState(false);
  const [feynmanText, setFeynmanText] = useState("");
  const [feynmanFeedback, setFeynmanFeedback] = useState<{ gaps: string[], praise: string } | null>(null);

  const handleCheckFeynman = async () => {
    if (!feynmanText.trim()) return;
    setIsCheckingFeynman(true);
    try {
      const source = notes.replace(/<[^>]*>?/gm, '');
      const response = await fetch('/api/feynman-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, explanation: feynmanText })
      });
      const data = await response.json();
      setFeynmanFeedback(data);
      // Give points based on fewer gaps
      if (data.gaps) {
        const score = Math.max(1, 10 - data.gaps.length * 2);
        updateFeynmanScore(score);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to evaluate explanation.');
    } finally {
      setIsCheckingFeynman(false);
    }
  };

  useEffect(() => {
    // Analyze notes whenever they change (debounce in real app)
    const text = notes.replace(/<[^>]*>?/gm, '').trim();
    if (text.length > 20) {
      setSourceMetrics(analyzeSourceQuality(text));
      setGlossary(extractGlossary(text));
    }
  }, [notes]);

  useEffect(() => {
    const handleSave = () => {
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2000);
    };
    window.addEventListener('saveNotes', handleSave);
    return () => window.removeEventListener('saveNotes', handleSave);
  }, []);

  const handleGenerateFlashcards = async () => {
    setIsGeneratingFlashcards(true);
    try {
      // Strip HTML tags for the prompt
      const text = notes.replace(/<[^>]*>?/gm, '');
      const response = await fetch('/api/generate-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      if (data.flashcards) {
        // Initialize with default FSRS values
        const initializedCards = data.flashcards.map((fc: any) => ({
          ...fc,
          fsrs: {
            stability: 2,
            difficulty: 5,
            retrievability: 1,
            last_review: new Date().toISOString(),
            next_review: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          }
        }));
        setFlashcards(initializedCards);
        setActiveTab('flashcards');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to generate flashcards');
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const handleGenerateBlueprint = async () => {
    setIsSummarizing(true);
    try {
      const text = notes.replace(/<[^>]*>?/gm, '');
      const response = await fetch('/api/generate-blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      
      if (data.ontology?.nodes) {
        addOntologyData(data.ontology.nodes, data.ontology.links);
      }
      
      if (data.modules && data.modules.length > 0) {
        import('localforage').then(localforage => {
          localforage.default.getItem<string>("memora-tasks").then(storedTasksStr => {
            const existingTasks = storedTasksStr ? JSON.parse(storedTasksStr) : [];
            const newTasks = data.modules.map((m: any, i: number) => ({
              id: Date.now() + i,
              title: m.title,
              time: `${m.durationMinutes} min`,
              course: file?.name || "Document Blueprint",
              type: "Reading",
              completed: false,
              description: m.description
            }));
            localforage.default.setItem("memora-tasks", JSON.stringify([...existingTasks, ...newTasks]));
            alert(`Generated ${newTasks.length} study tasks from blueprint!`);
          });
        });
      }

      if (data.glossary) {
        setGlossary(data.glossary);
        setShowGlossary(true);
      }
      
      setSummary("Blueprint generated successfully. Core concepts added to Knowledge Graph and Study Tasks created.");
    } catch (e) {
      console.error(e);
      alert('Failed to generate blueprint');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // If it's a PDF, we can use react-pdf. Otherwise, it's text.
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setSourceText("");
      } else {
        setFile(null);
      }

      auditLogger.log("DOCUMENT_UPLOADED", "current_user", selectedFile.name);
      xapi.logDocumentEngagement(
        "current_user",
        selectedFile.name,
        selectedFile.name,
        "read",
      );

      // Extract text via backend API
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const res = await fetch('/api/ingest/file', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        
        if (data.text) {
          const sanitized = detectAndSanitizePii(data.text);
          if (sanitized.hasPii) {
            setPiiWarning(
              `Detected PII during ingestion: ${sanitized.flags.map((f: any) => f.type).join(", ")}. Data has been sanitized in the indexing pipeline.`
            );
            auditLogger.log("PII_DETECTED", "system", selectedFile.name, {
              flags: sanitized.flags,
            });
          }
          
          setSourceMetrics(analyzeSourceQuality(sanitized.sanitizedText));
          setGlossary(extractGlossary(sanitized.sanitizedText));

          // Also trigger ontology extraction
          fetch('/api/extract-ontology', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: sanitized.sanitizedText.slice(0, 50000) })
          })
          .then(res => res.json())
          .then(ontology => {
            if (ontology.nodes && ontology.links) {
              addOntologyData(ontology.nodes, ontology.links);
            }
          })
          .catch(e => console.error("Failed to extract ontology", e));

          // Save to Vector Store for RAG
          import('../lib/vectorStore').then(async ({ chunkText, generateEmbedding, saveEmbedding }) => {
            try {
              const chunks = chunkText(sanitized.sanitizedText);
              const docId = `doc-${Date.now()}`;
              for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const embedding = await generateEmbedding(chunk);
                await saveEmbedding({
                  id: `${docId}-${i}`,
                  docId,
                  docTitle: selectedFile.name,
                  text: chunk,
                  embedding
                });
              }
              console.log("Vector embeddings saved for document");
            } catch (err) {
              console.error("Failed to generate and save embeddings", err);
            }
          });

          if (selectedFile.type !== 'application/pdf') {
            setSourceText(sanitized.sanitizedText);
          }
        }
      } catch (err) {
        console.error("Failed to extract file text", err);
      }
    }
  };

  const [urlInput, setUrlInput] = useState("");
  const [isIngestingUrl, setIsIngestingUrl] = useState(false);

  const handleUrlIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;
    
    setIsIngestingUrl(true);
    try {
      const res = await fetch('/api/ingest/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput })
      });
      const data = await res.json();
      
      if (data.text) {
        const sanitized = detectAndSanitizePii(data.text);
        if (sanitized.hasPii) {
          setPiiWarning(
            `Detected PII during ingestion: ${sanitized.flags.map((f: any) => f.type).join(", ")}. Data has been sanitized.`
          );
        }
        
        setSourceMetrics(analyzeSourceQuality(sanitized.sanitizedText));
        setGlossary(extractGlossary(sanitized.sanitizedText));
        
        // Also trigger ontology extraction
        fetch('/api/extract-ontology', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: sanitized.sanitizedText.slice(0, 50000) })
        })
        .then(res => res.json())
        .then(ontology => {
          if (ontology.nodes && ontology.links) {
            addOntologyData(ontology.nodes, ontology.links);
          }
        })
        .catch(e => console.error("Failed to extract ontology", e));

        // Save to Vector Store for RAG
        import('../lib/vectorStore').then(async ({ chunkText, generateEmbedding, saveEmbedding }) => {
          try {
            const chunks = chunkText(sanitized.sanitizedText);
            const docId = `url-${Date.now()}`;
            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i];
              const embedding = await generateEmbedding(chunk);
              await saveEmbedding({
                id: `${docId}-${i}`,
                docId,
                docTitle: urlInput,
                text: chunk,
                embedding
              });
            }
            console.log("Vector embeddings saved for URL");
          } catch (err) {
            console.error("Failed to generate and save embeddings", err);
          }
        });

        setSourceText(sanitized.sanitizedText);
        setFile(null); // Clear any pdf view
        setUrlInput("");
      } else {
        alert(data.error || "Failed to extract from URL");
      }
    } catch (err) {
      console.error(err);
      alert("Error processing URL");
    } finally {
      setIsIngestingUrl(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (
        selection &&
        selection.toString().trim() &&
        viewerRef.current?.contains(selection.anchorNode)
      ) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const viewerRect = viewerRef.current.getBoundingClientRect();

        setSelectionRect({
          x: rect.left - viewerRect.left + rect.width / 2,
          y: rect.top - viewerRect.top - 40,
          text: selection.toString().trim(),
        });
      } else if (!isNoteInputOpen) {
        setSelectionRect(null);
      }
    };

    document.addEventListener("mouseup", handleSelection);
    return () => document.removeEventListener("mouseup", handleSelection);
  }, [isNoteInputOpen]);

  const addAnnotation = (type: "highlight" | "note", noteText?: string) => {
    if (!selectionRect) return;

    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      type,
      text: selectionRect.text,
      page: pageNumber,
      note: noteText,
      createdAt: Date.now(),
    };

    setMetadata({
      ...metadata,
      annotations: [...(metadata.annotations || []), newAnnotation],
    });

    if (file) {
      xapi.logDocumentEngagement(
        "current_user",
        file.name,
        file.name,
        "annotated",
      );
    }

    setSelectionRect(null);
    setIsNoteInputOpen(false);
    setTempNote("");
    window.getSelection()?.removeAllRanges();
  };

  const pageAnnotations = (metadata.annotations || []).filter(
    (a) => a.page === pageNumber,
  );

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col">
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-slate-50 dark:bg-slate-900 relative">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-display font-bold text-slate-900 dark:text-white">
            Workspace
          </h2>
        </div>
        <div className="flex items-center gap-2 relative">
          <div className="relative">
            <button
              onClick={() => setIsReaderSettingsOpen(!isReaderSettingsOpen)}
              className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${isReaderSettingsOpen ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500'}`}
              title="Reader Settings"
            >
              <Settings2 className="w-5 h-5" />
            </button>
            
            <AnimatePresence>
              {isReaderSettingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden"
                >
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Reader Settings</h3>
                  </div>
                  <div className="p-2 flex flex-col gap-1">
                    <button
                      onClick={() => toggleBionicReading()}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <BookOpen className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-medium">Bionic Reading</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full transition-colors relative ${isBionicReading ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isBionicReading ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                    
                    <button
                      onClick={() => toggleDyslexiaFont()}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <Type className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-medium">Dyslexia Font</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full transition-colors relative ${isDyslexiaFont ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isDyslexiaFont ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                    
                    <button
                      onClick={() => toggleTTS()}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <Volume2 className="w-4 h-4 text-rose-500" />
                        <span className="text-sm font-medium">Read Aloud (TTS)</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full transition-colors relative ${isTTSActive ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isTTSActive ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                    
                    <button
                      onClick={() => toggleFeynmanMode()}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <BrainCircuit className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium">Feynman Mode</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full transition-colors relative ${isFeynmanMode ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isFeynmanMode ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            aria-label="Close workspace"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <PanelGroup orientation="horizontal">
        {/* PDF Viewer Side */}
        {!isFeynmanMode && (
          <Panel defaultSize={50} minSize={20} maxSize={80} id="pdf-panel">
          <div className="h-full border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50 flex flex-col relative">
            {piiWarning && (
              <div className="absolute top-4 left-4 right-4 z-10 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg shadow-sm flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">Data Sanitization Complete</p>
                  <p>{piiWarning}</p>
                </div>
                <button
                  aria-label="Close warning"
                  onClick={() => setPiiWarning(null)}
                  className="ml-auto text-amber-600 hover:text-amber-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          {!file && !sourceText ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
              <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-12 flex flex-col items-center justify-center text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors max-w-sm w-full text-center group shadow-sm">
                <Upload className="w-8 h-8 mb-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Upload PDF or Text File
                </span>
                <span className="text-sm mt-2">
                  Click to select or drag and drop
                </span>
                <input
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              <div className="max-w-sm w-full relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-slate-100 dark:bg-slate-900 px-3 text-sm text-slate-500">
                    OR
                  </span>
                </div>
              </div>

              <form onSubmit={handleUrlIngest} className="max-w-sm w-full flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="url"
                    placeholder="Enter YouTube URL..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-sm"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isIngestingUrl}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-3 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isIngestingUrl ? 'Loading...' : 'Extract'}
                </button>
              </form>
            </div>
          ) : sourceText && !file ? (
            <div className="flex-1 overflow-auto p-8 relative prose dark:prose-invert max-w-none">
              <h1 className="font-display text-2xl font-bold mb-4">Extracted Source Text</h1>
              <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-serif leading-relaxed">
                {sourceText}
              </div>
            </div>
          ) : (
            <div
              className="flex-1 overflow-auto p-4 flex flex-col items-center relative"
              ref={viewerRef}
            >
              <Document
                file={file}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center p-12 text-slate-500">
                    Loading PDF...
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  width={600}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="shadow-xl rounded-sm overflow-hidden"
                />
              </Document>

              <AnimatePresence>
                {selectionRect && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute z-50 flex items-center gap-1 bg-slate-900 text-white rounded-lg shadow-xl p-1"
                    style={{
                      left: selectionRect.x,
                      top: selectionRect.y,
                      transform: "translateX(-50%)",
                    }}
                  >
                    {!isNoteInputOpen ? (
                      <>
                        <button
                          onClick={() => addAnnotation("highlight")}
                          className="p-2 hover:bg-slate-700 rounded transition-colors flex flex-col items-center gap-1"
                          title="Highlight"
                        >
                          <Highlighter className="w-4 h-4 text-yellow-400" />
                        </button>
                        <div className="w-px h-6 bg-slate-700" />
                        <button
                          onClick={() => setIsNoteInputOpen(true)}
                          className="p-2 hover:bg-slate-700 rounded transition-colors flex flex-col items-center gap-1"
                          title="Add Note"
                        >
                          <MessageSquarePlus className="w-4 h-4 text-indigo-400" />
                        </button>
                        <div className="w-px h-6 bg-slate-700" />
                        <button
                          onClick={() => {
                            const u = new SpeechSynthesisUtterance(
                              selectionRect.text,
                            );
                            window.speechSynthesis.speak(u);
                            setSelectionRect(null);
                            window.getSelection()?.removeAllRanges();
                          }}
                          className="p-2 hover:bg-slate-700 rounded transition-colors flex flex-col items-center gap-1"
                          title="Read Aloud (TTS)"
                        >
                          <Volume2 className="w-4 h-4 text-emerald-400" />
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-1">
                        <input
                          autoFocus
                          type="text"
                          value={tempNote}
                          onChange={(e) => setTempNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              addAnnotation("note", tempNote);
                            if (e.key === "Escape") {
                              setIsNoteInputOpen(false);
                              setSelectionRect(null);
                            }
                          }}
                          placeholder="Type note and press Enter..."
                          className="bg-slate-800 text-sm text-white px-2 py-1 rounded outline-none w-48"
                        />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {numPages > 0 && (
                <div className="fixed bottom-4 left-1/4 -translate-x-1/2 flex items-center gap-4 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 z-10">
                  <button
                    disabled={pageNumber <= 1}
                    onClick={() =>
                      setPageNumber(Math.max(pageNumber - 1, 1))
                    }
                    className="text-sm font-medium hover:text-indigo-600 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-sm font-mono text-slate-500">
                    {pageNumber} / {numPages}
                  </span>
                  <button
                    disabled={pageNumber >= numPages}
                    onClick={() =>
                      setPageNumber(Math.min(pageNumber + 1, numPages))
                    }
                    className="text-sm font-medium hover:text-indigo-600 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
          </Panel>
        )}

        {!isFeynmanMode && <PanelResizeHandle className="w-1 bg-slate-200 dark:bg-slate-800 hover:bg-indigo-500 transition-colors cursor-col-resize" />}

        {/* Notes Side */}
        <Panel id="notes-panel">
          <PanelGroup orientation="vertical">
            <Panel defaultSize={60} minSize={30} id="tools-panel">
        <div className={`bg-white dark:bg-slate-950 flex flex-col h-full border-l border-slate-200 dark:border-slate-800 w-full`}>
          {pageAnnotations.length > 0 && (
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 overflow-y-auto max-h-48">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Page Annotations
              </h4>
              <div className="space-y-2">
                {pageAnnotations.map((ann) => (
                  <div
                    key={ann.id}
                    className="text-sm bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-2"
                  >
                    {ann.type === "highlight" ? (
                      <Highlighter className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                    ) : (
                      <MessageSquarePlus className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="italic text-slate-600 dark:text-slate-400 border-l-2 border-slate-300 dark:border-slate-600 pl-2 mb-1">
                        "{ann.text}"
                      </p>
                      {ann.note && (
                        <p className="text-slate-900 dark:text-slate-200 font-medium">
                          {ann.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(metadata.generatedImages || []).length > 0 && (
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 overflow-y-auto max-h-48">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Generated Visual Aids
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {(metadata.generatedImages || []).map((img, i) => (
                  <div
                    key={i}
                    className="shrink-0 w-32 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white"
                  >
                    <img
                      src={img.url}
                      alt={img.prompt}
                      className="w-full h-24 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <p className="text-[10px] text-slate-500 truncate p-1">
                      {img.prompt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 flex flex-col gap-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300">
                Workspace
              </h3>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Save className="w-3 h-3" /> Auto-saved
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleGenerateBlueprint}
                disabled={isSummarizing}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
              >
                <BrainCircuit className="w-3.5 h-3.5" /> 
                {isSummarizing ? 'Generating Blueprint...' : 'Generate Course Blueprint'}
              </button>

              <button
                onClick={handleGenerateFlashcards}
                disabled={isGeneratingFlashcards}
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
              >
                <BrainCircuit className="w-3.5 h-3.5" /> 
                {isGeneratingFlashcards ? 'Generating...' : 'Flashcards'}
              </button>

              <button
                onClick={async () => {
                  try {
                    const { getAccessToken } = await import("../lib/auth");
                    const token = await getAccessToken();
                    if (!token) return alert("Please sign in to Google");

                    const blob = new Blob([notes], { type: "text/html" });
                    const metadata = {
                      name: `${file?.name || "Document"} - Notes.html`,
                      mimeType: "text/html",
                    };
                    const form = new FormData();
                    form.append(
                      "metadata",
                      new Blob([JSON.stringify(metadata)], {
                        type: "application/json",
                      }),
                    );
                    form.append("file", blob);

                    const res = await fetch(
                      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
                      {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                        body: form,
                      },
                    );
                    if (res.ok) alert("Saved to Google Drive!");
                    else alert("Failed to save to Drive");
                  } catch (e) {
                    console.error(e);
                    alert("Failed to save to Drive");
                  }
                }}
                className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg"
                  className="w-3.5 h-3.5"
                  alt="Drive"
                />{" "}
                Drive
              </button>

              <button
                onClick={async () => {
                  try {
                    const { getAccessToken } = await import("../lib/auth");
                    const token = await getAccessToken();
                    if (!token) return alert("Please sign in to Google");
                    const res = await fetch(
                      "https://docs.googleapis.com/v1/documents",
                      {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          title: `${file?.name || "Document"} - Notes`,
                        }),
                      },
                    );
                    const data = await res.json();
                    if (data.documentId) {
                      window.open(
                        `https://docs.google.com/document/d/${data.documentId}/edit`,
                        "_blank",
                      );
                    }
                  } catch (e) {
                    console.error(e);
                    alert("Failed to export to Google Docs");
                  }
                }}
                className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/0/01/Google_Docs_logo_%282014-2020%29.svg"
                  className="w-3.5 h-3.5"
                  alt="Docs"
                />{" "}
                Docs
              </button>

              <button
                onClick={async () => {
                  try {
                    const { getAccessToken } = await import("../lib/auth");
                    const token = await getAccessToken();
                    if (!token) return alert("Please sign in to Google");
                    const res = await fetch(
                      "https://slides.googleapis.com/v1/presentations",
                      {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          title: `${file?.name || "Document"} - Flashcards`,
                        }),
                      },
                    );
                    const data = await res.json();
                    if (data.presentationId) {
                      window.open(
                        `https://docs.google.com/presentation/d/${data.presentationId}/edit`,
                        "_blank",
                      );
                    }
                  } catch (e) {
                    console.error(e);
                    alert("Failed to generate Google Slides");
                  }
                }}
                className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/1/1e/Google_Slides_logo_%282014-2020%29.svg"
                  className="w-3.5 h-3.5"
                  alt="Slides"
                />{" "}
                Slides
              </button>

              <button
                onClick={async () => {
                  try {
                    const { getAccessToken } = await import("../lib/auth");
                    const token = await getAccessToken();
                    if (!token) return alert("Please sign in to Google");
                    const res = await fetch(
                      "https://forms.googleapis.com/v1/forms",
                      {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          info: {
                            title: `${file?.name || "Document"} - Auto Quiz`,
                            documentTitle: `${file?.name || "Document"} - Auto Quiz`,
                          },
                        }),
                      },
                    );
                    const data = await res.json();
                    if (data.formId) {
                      window.open(
                        `https://docs.google.com/forms/d/${data.formId}/edit`,
                        "_blank",
                      );
                    }
                  } catch (e) {
                    console.error(e);
                    alert("Failed to generate Google Form");
                  }
                }}
                className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/5/5b/Google_Forms_2020_Logo.svg"
                  className="w-3.5 h-3.5"
                  alt="Forms"
                />{" "}
                Forms
              </button>

              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

              <button
                onClick={() => setShowGlossary(!showGlossary)}
                className={`text-xs font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${showGlossary ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                <FileText className="w-3.5 h-3.5" /> Glossary
              </button>

              <button
                onClick={() => setIsImageModalOpen(true)}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5" /> Diagram
              </button>
            </div>
          </div>
          <div className="flex-1 p-4 pt-0 h-full min-h-0 flex flex-col relative overflow-hidden">
            {sourceMetrics && <SourceAnalysis metrics={sourceMetrics} />}

            <div role="tablist" aria-label="Document tools" className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 mb-4 px-2">
              <button 
                role="tab"
                aria-selected={activeTab === 'notes'}
                aria-controls="panel-notes"
                id="tab-notes"
                onClick={() => setActiveTab('notes')}
                className={`pb-3 text-sm font-bold transition-colors ${activeTab === 'notes' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-b-2 border-transparent'}`}
              >
                Notes
              </button>
              <button 
                role="tab"
                aria-selected={activeTab === 'flashcards'}
                aria-controls="panel-flashcards"
                id="tab-flashcards"
                onClick={() => setActiveTab('flashcards')}
                className={`pb-3 text-sm font-bold transition-colors ${activeTab === 'flashcards' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-b-2 border-transparent'}`}
              >
                Flashcards
              </button>
              <button 
                role="tab"
                aria-selected={activeTab === 'agent'}
                aria-controls="panel-agent"
                id="tab-agent"
                onClick={() => setActiveTab('agent')}
                className={`pb-3 text-sm font-bold transition-colors ${activeTab === 'agent' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-b-2 border-transparent'}`}
              >
                Ask Agent
              </button>
              <button 
                role="tab"
                aria-selected={activeTab === 'feynman'}
                aria-controls="panel-feynman"
                id="tab-feynman"
                onClick={() => setActiveTab('feynman')}
                className={`pb-3 text-sm font-bold transition-colors ${activeTab === 'feynman' ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-600 dark:border-amber-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-b-2 border-transparent'}`}
              >
                Feynman Mode
              </button>
            </div>

            <div className="flex-1 min-h-0 flex gap-4">
              <div className="flex-1 flex flex-col min-w-0">
                {activeTab === 'notes' && (
                  isNotesLoaded ? (
                    <div role="tabpanel" id="panel-notes" aria-labelledby="tab-notes" className="flex-1 flex flex-col">
                      <NotesEditor initialContent={notes} onChange={setNotes} />
                    </div>
                  ) : (
                    <div role="tabpanel" id="panel-notes" aria-labelledby="tab-notes" className="flex-1 flex items-center justify-center text-slate-400">
                      Loading notes...
                    </div>
                  )
                )}

                {activeTab === 'feynman' && (
                    <div role="tabpanel" id="panel-feynman" aria-labelledby="tab-feynman" className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden shadow-inner">
                      <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-3 border-b border-amber-100 dark:border-amber-800 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                             <BrainCircuit className="w-4 h-4" /> Feynman Technique
                          </h4>
                          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Explain the topic in your own words. The original notes are hidden.</p>
                        </div>
                        <button 
                          onClick={handleCheckFeynman}
                          disabled={isCheckingFeynman || !feynmanText.trim()}
                          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        >
                          {isCheckingFeynman ? 'Analyzing...' : 'Check Understanding'}
                        </button>
                      </div>
                      
                      <div className="flex-1 flex flex-col relative">
                        {isCheckingFeynman && (
                          <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
                            <div className="text-amber-600 font-medium animate-pulse">Evaluating your explanation...</div>
                          </div>
                        )}
                        <textarea
                          value={feynmanText}
                          onChange={(e) => setFeynmanText(e.target.value)}
                          placeholder="Start typing your explanation here..."
                          className="flex-1 w-full p-4 bg-transparent resize-none outline-none text-slate-800 dark:text-slate-200 leading-relaxed"
                        />
                      </div>

                      {feynmanFeedback && (
                        <div className="bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 max-h-48 overflow-y-auto">
                          <h5 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2">Analysis Complete</h5>
                          <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">{feynmanFeedback.praise}</p>
                          
                          {feynmanFeedback.gaps && feynmanFeedback.gaps.length > 0 && (
                            <>
                              <h5 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-2">Knowledge Gaps Identified:</h5>
                              <ul className="list-disc list-inside space-y-1">
                                {feynmanFeedback.gaps.map((gap, i) => (
                                  <li key={i} className="text-sm text-slate-600 dark:text-slate-400">{gap}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                )}

                {activeTab === 'flashcards' && (
                  <div role="tabpanel" id="panel-flashcards" aria-labelledby="tab-flashcards" className="flex-1 overflow-y-auto">
                    {flashcards.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <BrainCircuit className="w-12 h-12 mb-4 text-slate-300 dark:text-slate-600" />
                        <p>No flashcards generated yet.</p>
                        <button onClick={handleGenerateFlashcards} className="mt-4 text-indigo-600 hover:underline text-sm font-medium">Generate from notes</button>
                      </div>
                    ) : (
                      <div className="space-y-4 pb-4">
                        {flashcards.map((fc, i) => (
                          <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-4">
                            <div>
                              <div className="text-xs font-bold text-slate-400 mb-2 tracking-wider uppercase">Question</div>
                              <p className="font-bold text-slate-900 dark:text-slate-100 text-lg">{fc.question}</p>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-emerald-500 mb-2 tracking-wider uppercase">Answer</div>
                              <p className="text-slate-700 dark:text-slate-300 text-base">{fc.answer}</p>
                            </div>
                            
                            {fc.fsrs && (
                              <div className="flex flex-wrap gap-2 text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-2">
                                <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Difficulty: {fc.fsrs.difficulty}</span>
                                <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Retrievability: {(fc.fsrs.retrievability * 100).toFixed(0)}%</span>
                                {fc.fsrs.next_review && (
                                  <span className="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-1 rounded">
                                    Next: {new Date(fc.fsrs.next_review).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                              <button onClick={() => handleReviewFlashcard(i, 'again')} className="flex-1 py-2 text-sm font-semibold rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 transition-colors">Again</button>
                              <button onClick={() => handleReviewFlashcard(i, 'hard')} className="flex-1 py-2 text-sm font-semibold rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 transition-colors">Hard</button>
                              <button onClick={() => handleReviewFlashcard(i, 'good')} className="flex-1 py-2 text-sm font-semibold rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 transition-colors">Good</button>
                              <button onClick={() => handleReviewFlashcard(i, 'easy')} className="flex-1 py-2 text-sm font-semibold rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 transition-colors">Easy</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'agent' && (
                  <div role="tabpanel" id="panel-agent" aria-labelledby="tab-agent" className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0">
                          <BrainCircuit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                          Hello! I'm your RAG Agent. I can answer questions based purely on the documents and notes you've provided.
                        </div>
                      </div>
                      
                      {agentResponse && (
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0">
                            <BrainCircuit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {agentResponse.split(/(\[Citation: [^\]]+\])/).map((part, i) => {
                              if (part.startsWith('[Citation:')) {
                                return (
                                  <button 
                                    key={i} 
                                    onClick={() => alert(`This citation points to ${part.replace(/\[|\]/g, '')}. You could implement auto-scroll here.`)}
                                    className="inline-block bg-indigo-100 dark:bg-indigo-800/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-xs font-mono ml-1 hover:bg-indigo-200 dark:hover:bg-indigo-700 transition-colors cursor-pointer"
                                  >
                                    {part}
                                  </button>
                                );
                              }
                              return part;
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <form onSubmit={(e) => { e.preventDefault(); handleAskAgent(); }} className="flex gap-2">
                        <button
                          type="button"
                          onClick={toggleAgentDictation}
                          title={isAgentDictating ? "Stop dictating" : "Dictate question"}
                          className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isAgentDictating ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                        >
                          <Mic className="w-5 h-5" />
                        </button>
                        <input
                          type="text"
                          value={agentQuery}
                          onChange={e => setAgentQuery(e.target.value)}
                          placeholder="Ask a question about your notes..."
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="submit"
                          disabled={isAskingAgent || !agentQuery.trim()}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          {isAskingAgent ? 'Thinking...' : 'Ask'}
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
              
              <AnimatePresence>
                {showGlossary && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 250, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="h-full border-l border-slate-200 dark:border-slate-700 pl-4 overflow-y-auto flex-shrink-0"
                  >
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Glossary</h4>
                    {glossary.length === 0 ? (
                      <p className="text-xs text-slate-500">Not enough text to extract glossary.</p>
                    ) : (
                      <div className="space-y-2">
                        {glossary.map((g, i) => (
                          <button 
                            key={i} 
                            onClick={() => handleGetDefinition(g.term)}
                            className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                          >
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{g.term}</span>
                            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">{g.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {glossaryDefinition && (
                      <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">{glossaryDefinition.term}</h5>
                          <button aria-label="Close definition" onClick={() => setGlossaryDefinition(null)} className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-xs text-slate-700 dark:text-slate-300">
                          {glossaryDefinition.loading ? (
                            <span className="flex items-center gap-2 text-indigo-500">
                              <BrainCircuit className="w-3.5 h-3.5 animate-pulse" /> Loading definition...
                            </span>
                          ) : (
                            glossaryDefinition.definition
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {summary && (
              <div className="mt-4 p-4 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-indigo-500" /> Summary
                  </h4>
                  <button onClick={() => setSummary(null)} className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {summary}
                </div>
              </div>
            )}
          </div>
        </div>
        </Panel>

        <PanelResizeHandle className="h-1 bg-slate-200 dark:bg-slate-800 hover:bg-indigo-500 transition-colors cursor-row-resize relative group">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 group-hover:bg-indigo-500/10 transition-colors flex items-center justify-center">
            <div className="w-8 h-1 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-indigo-500 transition-colors" />
          </div>
        </PanelResizeHandle>

        <Panel defaultSize={40} minSize={20} id="graph-panel">
          <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-col border-t border-slate-200 dark:border-slate-800">
            <KnowledgeGraph />
          </div>
        </Panel>
        
        </PanelGroup>
        </Panel>
      </PanelGroup>
      </div>

      <AnimatePresence>
        {showSaveToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-[60]"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium">Notes saved!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <ImageGeneratorModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onSave={(url, prompt) => {
          setMetadata({
            ...metadata,
            generatedImages: [
              ...(metadata.generatedImages || []),
              { url, prompt },
            ],
          });
          if (file) {
            xapi.logDocumentEngagement(
              "current_user",
              file.name,
              file.name,
              "generated_diagram",
            );
          }
        }}
      />
    </div>
  );
}
