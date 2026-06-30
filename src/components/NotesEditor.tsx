import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { BookOpen, Volume2, Type, BrainCircuit, X } from 'lucide-react';
import { useStore } from '../store/useStore';

import { SmartCodeBlock } from '../lib/tiptap-extensions';

// Simple bionic reading formatter (bolds first half of words)
function applyBionicReading(html: string) {
  // We parse the HTML, find text nodes, and wrap first halves of words in <b> tags
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      const text = node.nodeValue || '';
      const newText = text.replace(/([a-zA-Z]+)/g, (word) => {
        const mid = Math.ceil(word.length / 2);
        return `<strong>${word.slice(0, mid)}</strong>${word.slice(mid)}`;
      });
      const span = document.createElement('span');
      span.innerHTML = newText;
      node.parentNode?.replaceChild(span, node);
    } else {
      Array.from(node.childNodes).forEach(walk);
    }
  };
  
  Array.from(temp.childNodes).forEach(walk);
  return temp.innerHTML;
}

export default function NotesEditor({ initialContent, onChange }: { initialContent: string, onChange: (content: string) => void }) {
  const [localIsReadMode, setLocalIsReadMode] = useState(false);
  const [explanation, setExplanation] = useState<{ text: string, visible: boolean } | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  
  const isBionic = useStore(state => state.isBionicReading);
  const isDyslexicFont = useStore(state => state.isDyslexiaFont);
  const isPlaying = useStore(state => state.isTTSActive);
  const toggleTTSActive = useStore(state => state.toggleTTS);
  
  const isReadMode = localIsReadMode || isBionic;
  
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleUpdate = useCallback((content: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onChange(content);
    }, 1000); // 1-second debounce for auto-save
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      SmartCodeBlock,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      handleUpdate(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert prose-sm sm:prose-base focus:outline-none max-w-none w-full min-h-[300px]',
      },
    },
  });

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isPlaying && editor) {
      const text = document.createElement('div');
      text.innerHTML = editor.getHTML();
      const utterance = new SpeechSynthesisUtterance(text.textContent || '');
      utterance.onend = () => {
        if (useStore.getState().isTTSActive) {
          useStore.getState().toggleTTS();
        }
      };
      speechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } else if (!isPlaying) {
      window.speechSynthesis.cancel();
    }
    
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [isPlaying, editor]);

  const handleExplain = async () => {
    if (!editor) return;
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ' '
    );
    if (!selectedText.trim()) return;

    setIsExplaining(true);
    setExplanation({ text: 'Thinking...', visible: true });

    try {
      const response = await fetch('/api/agent/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: editor.getText(), 
          query: `Explain the concept of "${selectedText}" from scratch, assuming I have no prior knowledge.` 
        })
      });
      const data = await response.json();
      setExplanation({ text: data.text, visible: true });
    } catch (e) {
      console.error(e);
      setExplanation({ text: 'Failed to generate explanation.', visible: true });
    } finally {
      setIsExplaining(false);
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl overflow-hidden shadow-sm relative">
      <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          {!isReadMode && (
            <>
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`px-2 py-1 rounded text-sm font-semibold ${editor.isActive('bold') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                Bold
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`px-2 py-1 rounded text-sm italic ${editor.isActive('italic') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                Italic
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`px-2 py-1 rounded text-sm font-bold ${editor.isActive('heading', { level: 2 }) ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                H2
              </button>
              <button
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={`px-2 py-1 rounded text-sm font-mono ${editor.isActive('codeBlock') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                Code
              </button>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Cognitive Settings */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => useStore.getState().toggleBionicReading()}
              title="Bionic Reading"
              className={`p-1.5 rounded transition-colors ${isBionic ? 'bg-indigo-200 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              <Type className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => useStore.getState().toggleDyslexiaFont()}
              title="Dyslexia Font"
              className={`p-1.5 rounded transition-colors font-serif font-bold ${isDyslexicFont ? 'bg-indigo-200 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              D
            </button>
            <button
              onClick={() => toggleTTSActive()}
              title="Text-to-Speech"
              className={`p-1.5 rounded transition-colors ${isPlaying ? 'bg-amber-200 text-amber-700 dark:bg-amber-900 dark:text-amber-300' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => {
              setLocalIsReadMode(!localIsReadMode);
            }}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors font-medium ${isReadMode ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            {isReadMode ? 'Edit Mode' : 'Read Mode'}
          </button>
        </div>
      </div>
      <div className={`p-4 flex-1 overflow-y-auto ${isDyslexicFont ? 'font-dyslexic' : ''}`}>
        {isReadMode ? (
          <div 
            className="prose dark:prose-invert prose-sm sm:prose-base max-w-none"
            dangerouslySetInnerHTML={{ __html: isBionic ? applyBionicReading(editor.getHTML()) : editor.getHTML() }}
          />
        ) : (
          <>
            <EditorContent editor={editor} />
          </>
        )}
      </div>

      {explanation && explanation.visible && (
        <div className="absolute bottom-4 left-4 right-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-indigo-200 dark:border-indigo-800/50 p-4 max-h-[50%] overflow-y-auto z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-2 text-sm">
              <BrainCircuit className="w-4 h-4" /> Explanation from Scratch
            </h4>
            <button onClick={() => setExplanation(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {explanation.text}
          </div>
        </div>
      )}
    </div>
  );
}
