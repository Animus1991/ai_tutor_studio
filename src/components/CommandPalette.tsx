import { useState, useEffect, useRef } from "react";
import { Search, FileText, CheckSquare, X, BrainCircuit, Type, BookOpen, ChevronRight, Moon, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import localforage from "localforage";
import { auth, db } from "../lib/firebase";
import { collection, query, getDocs } from "firebase/firestore";
import { useSearch } from "../hooks/useSearch";

type SearchResult = {
  id: string;
  type: "task" | "course" | "ai_log" | "action";
  title: string;
  subtitle?: string;
  url: string;
};

export default function CommandPalette() {
  const { isOpen, openSearch, closeSearch } = useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCommandMode, setIsCommandMode] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const toggleFeynmanMode = useStore(state => state.toggleFeynmanMode);
  const toggleBionicReading = useStore(state => state.toggleBionicReading);
  const toggleDyslexiaFont = useStore(state => state.toggleDyslexiaFont);
  const toggleDarkMode = useStore(state => state.toggleDarkMode);
  const toggleFocusMode = useStore(state => state.toggleFocusMode);

  const commands = [
    { text: "Toggle Feynman Mode", icon: <BrainCircuit className="w-4 h-4 text-amber-500" />, action: "feynman" },
    { text: "Toggle Bionic Reading", icon: <BookOpen className="w-4 h-4 text-indigo-500" />, action: "bionic" },
    { text: "Toggle Dyslexia Font", icon: <Type className="w-4 h-4 text-emerald-500" />, action: "dyslexia" },
    { text: "Toggle Dark Mode", icon: <Moon className="w-4 h-4 text-indigo-500" />, action: "dark" },
    { text: "Toggle Focus Mode", icon: <Search className="w-4 h-4 text-rose-500" />, action: "focus" },
    { text: "Sync Knowledge Base (Vectors)", icon: <BrainCircuit className="w-4 h-4 text-sky-500" />, action: "sync" },
  ];

  const filteredCommands = commands.filter(c => c.text.toLowerCase().includes(searchQuery.substring(1).toLowerCase()));
  const defaultActions = [
    { label: "View Dashboard", icon: <Search className="w-4 h-4 text-rose-500" />, url: "/" },
    { label: "Upcoming Tasks", icon: <CheckSquare className="w-4 h-4 text-emerald-500" />, url: "/tasks" },
    { label: "Recent Study Notes", icon: <FileText className="w-4 h-4 text-sky-500" />, url: "/library" },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "k")) {
        e.preventDefault();
        openSearch();
      }
      if (e.key === "Escape" && isOpen) {
        closeSearch();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, openSearch, closeSearch]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery, isOpen]);

  const handleKeyDownInput = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      let maxLen = 0;
      if (isCommandMode) maxLen = filteredCommands.length;
      else if (isSemanticMode && results.length > 0) maxLen = results.length;
      else if (searchQuery.trim() && !isSemanticMode && results.length > 0) maxLen = results.length;
      else if (!searchQuery.trim()) maxLen = defaultActions.length;
      setActiveIndex((prev) => (prev + 1) % (maxLen || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      let maxLen = 0;
      if (isCommandMode) maxLen = filteredCommands.length;
      else if (isSemanticMode && results.length > 0) maxLen = results.length;
      else if (searchQuery.trim() && !isSemanticMode && results.length > 0) maxLen = results.length;
      else if (!searchQuery.trim()) maxLen = defaultActions.length;
      setActiveIndex((prev) => (prev - 1 + maxLen) % (maxLen || 1));
    }
  };

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const [isSemanticMode, setIsSemanticMode] = useState(false);
  const [semanticLoading, setSemanticLoading] = useState(false);

  useEffect(() => {
    setIsCommandMode(searchQuery.startsWith(">"));
    setIsSemanticMode(searchQuery.startsWith("?"));
    
    if (searchQuery.trim() && !searchQuery.startsWith(">") && !searchQuery.startsWith("?")) {
      performSearch(searchQuery.toLowerCase());
    } else {
      setResults([]);
    }
  }, [searchQuery]);

  const performSemanticSearch = async (term: string) => {
    if (!term.trim()) return;
    setSemanticLoading(true);
    try {
      const { searchVectors } = await import("../lib/vectorStore");
      const vectorResults = await searchVectors(term, 5);
      setResults(vectorResults.map(r => ({
        id: r.id,
        type: "action",
        title: r.text.substring(0, 60) + "...",
        subtitle: `Semantic Match • ${r.docTitle}`,
        url: "/library", // Navigates to library where notes reside
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setSemanticLoading(false);
    }
  };

  const performSearch = async (term: string) => {
    const user = auth.currentUser;
    const newResults: SearchResult[] = [];

    // Search tasks & courses if logged in
    if (user) {
      try {
        const tasksQuery = query(collection(db, "users", user.uid, "tasks"));
        const tasksSnapshot = await getDocs(tasksQuery);
        tasksSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.title?.toLowerCase().includes(term) || data.course?.toLowerCase().includes(term)) {
            newResults.push({
              id: doc.id,
              type: "task",
              title: data.title,
              subtitle: data.course || "Task",
              url: "/tasks"
            });
          }
        });

        const coursesQuery = query(collection(db, "users", user.uid, "courses"));
        const coursesSnapshot = await getDocs(coursesQuery);
        coursesSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.title?.toLowerCase().includes(term)) {
            newResults.push({
              id: doc.id,
              type: "course",
              title: data.title,
              subtitle: "Library Course",
              url: "/library"
            });
          }
        });
      } catch (err) {
        console.error("Error searching firebase", err);
      }
    }

    // Search AI logs
    try {
      const logs = await localforage.getItem<any[]>("memora-ai-logs");
      if (logs) {
        logs.forEach(log => {
          if (log.content?.toLowerCase().includes(term)) {
            newResults.push({
              id: log.id,
              type: "ai_log",
              title: log.content.substring(0, 60) + "...",
              subtitle: "AI Conversation Log",
              url: "/agent"
            });
          }
        });
      }
    } catch (err) {
      console.error("Error searching ai logs", err);
    }

    // Search current document content
    try {
      const docStorageRaw = await localforage.getItem<string>("document-storage");
      const docStorage = typeof docStorageRaw === 'string' ? JSON.parse(docStorageRaw) : docStorageRaw;
      const docNotes = docStorage?.state?.notes;
      if (docNotes && typeof docNotes === 'string' && docNotes.toLowerCase().includes(term)) {
        const textOnly = docNotes.replace(/<[^>]*>?/gm, '');
        const idx = textOnly.toLowerCase().indexOf(term);
        if (idx !== -1) {
          const snippet = textOnly.substring(Math.max(0, idx - 20), Math.min(textOnly.length, idx + 40));
          newResults.push({
            id: "doc-search",
            type: "action",
            title: `"...${snippet}..."`,
            subtitle: "In Current Document",
            url: "/library"
          });
        }
      }
    } catch (err) {
      console.error("Error searching document", err);
    }

    setResults(newResults);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isCommandMode) {
      if (filteredCommands[activeIndex]) {
        executeCommand(filteredCommands[activeIndex].action);
      }
    } else if (isSemanticMode && results.length === 0 && !semanticLoading) {
      performSemanticSearch(searchQuery.substring(1));
    } else if (searchQuery.trim() && results.length > 0) {
      if (results[activeIndex]) {
        navigate(results[activeIndex].url);
        closeSearch();
        setSearchQuery("");
      }
    } else if (!searchQuery.trim()) {
      if (defaultActions[activeIndex]) {
        navigate(defaultActions[activeIndex].url);
        closeSearch();
        setSearchQuery("");
      }
    }
  };

  const syncKnowledgeBase = async () => {
    try {
      const { chunkText, generateEmbedding, saveEmbedding, deleteEmbeddingsForDoc } = await import("../lib/vectorStore");
      const { globalCrdtStore } = await import("../lib/crdt");
      
      const notes = globalCrdtStore.getText("workspace-notes").toString();
      const textOnly = notes.replace(/<[^>]*>?/gm, '');
      
      if (textOnly.trim().length > 0) {
        await deleteEmbeddingsForDoc("main-notes");
        const chunks = chunkText(textOnly);
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = await generateEmbedding(chunk);
          await saveEmbedding({
            id: `main-notes-${i}`,
            docId: "main-notes",
            docTitle: "Workspace Notes",
            text: chunk,
            embedding
          });
        }
      }
      alert("Knowledge base synced successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to sync knowledge base");
    }
  };

  const executeCommand = (cmd: string) => {
    if (cmd.includes("feynman")) {
       toggleFeynmanMode();
    } else if (cmd.includes("bionic")) {
       toggleBionicReading();
    } else if (cmd.includes("dyslexi")) {
       toggleDyslexiaFont();
    } else if (cmd.includes("dark") || cmd.includes("theme")) {
       toggleDarkMode();
    } else if (cmd.includes("focus")) {
       toggleFocusMode();
    } else if (cmd.includes("sync")) {
       syncKnowledgeBase();
    }
    closeSearch();
    setSearchQuery("");
  };

  return (
    <>
      <button 
        aria-label="Open command palette"
        onClick={() => openSearch()}
        className="w-9 h-9 md:w-64 md:h-10 rounded-full md:rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center md:justify-start md:px-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm"
      >
        <Search className="w-4 h-4 md:mr-2" strokeWidth={1.5} />
        <span className="hidden md:inline text-sm">Search notes & tasks...</span>
        <span className="hidden md:inline ml-auto text-xs bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 font-mono border border-slate-300 dark:border-slate-600">
          ⌘K
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/20 dark:bg-slate-900/60 backdrop-blur-sm z-50"
              onClick={() => closeSearch()}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="fixed top-[10%] left-1/2 -translate-x-1/2 w-[90%] max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
            >
              <form onSubmit={handleSearch} className="flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                {isCommandMode ? (
                  <ChevronRight className="w-5 h-5 text-indigo-500" />
                ) : (
                  <Search className="w-5 h-5 text-slate-400" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDownInput}
                  placeholder="Search your knowledge base... (Type > for commands, ? for AI semantic search)"
                  className={`flex-1 bg-transparent border-none outline-none px-3 placeholder:text-slate-400 ${isCommandMode ? 'text-indigo-600 font-mono font-bold' : isSemanticMode ? 'text-sky-600 font-medium' : 'text-slate-900 dark:text-white'}`}
                />
                <button type="button" aria-label="Close search" onClick={() => closeSearch()} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </form>
              <div className="p-2 max-h-80 overflow-y-auto">
                {isCommandMode ? (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Available Commands</div>
                    {filteredCommands.map((cmd, i) => (
                      <button 
                        key={i} 
                        onClick={() => executeCommand(cmd.action)} 
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors text-sm ${i === activeIndex ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'}`}
                      >
                        {cmd.icon}
                        <span className="font-medium">{cmd.text}</span>
                      </button>
                    ))}
                  </>
                ) : isSemanticMode ? (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-sky-500 uppercase tracking-wider">AI Semantic Search</div>
                    {semanticLoading ? (
                      <div className="px-3 py-4 text-center text-sm text-slate-500">Generating embeddings & searching...</div>
                    ) : results.length > 0 ? (
                      results.map((result, i) => (
                        <button
                          key={result.id}
                          onClick={() => {
                            navigate(result.url);
                            closeSearch();
                            setSearchQuery("");
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors text-sm ${i === activeIndex ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'}`}
                        >
                          <BrainCircuit className="w-4 h-4 text-sky-500 shrink-0" />
                          <div className="truncate">
                            <span className="font-medium block truncate">{result.title}</span>
                            <span className="text-xs text-slate-500">{result.subtitle}</span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-center text-sm text-slate-500">Press enter to search conceptually across your library.</div>
                    )}
                  </>
                ) : searchQuery.trim() ? (
                  <>
                    {results.length > 0 ? (
                      <>
                        <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Search Results</div>
                        {results.map((result, i) => (
                          <button
                            key={result.id}
                            onClick={() => {
                              navigate(result.url);
                              closeSearch();
                              setSearchQuery("");
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors text-sm ${i === activeIndex ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'}`}
                          >
                            {result.type === "task" && <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />}
                            {result.type === "course" && <FileText className="w-4 h-4 text-sky-500 shrink-0" />}
                            {result.type === "ai_log" && <Bot className="w-4 h-4 text-indigo-500 shrink-0" />}
                            <div className="truncate">
                              <span className="font-medium block truncate">{result.title}</span>
                              <span className="text-xs text-slate-500">{result.subtitle}</span>
                            </div>
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="px-3 py-4 text-center text-sm text-slate-500">No results found for "{searchQuery}"</div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick Suggestions</div>
                    <button onClick={() => { setSearchQuery(">"); inputRef.current?.focus(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors text-slate-700 dark:text-slate-300 text-sm">
                      <ChevronRight className="w-4 h-4 text-indigo-500" />
                      View Actions & Commands
                    </button>
                    {defaultActions.map((action, i) => (
                      <button 
                        key={i}
                        onClick={() => { navigate(action.url); closeSearch(); }} 
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors text-sm ${i === activeIndex ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'}`}
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
