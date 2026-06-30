import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlock from '@tiptap/extension-code-block';
import { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { Play, Code2, Terminal } from 'lucide-react';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

// Pyodide is loaded dynamically from CDN to avoid Node.js module issues in Vite
let pyodideInstance: any = null;

const loadPyodideEngine = async () => {
  if (!pyodideInstance) {
    if (!(window as any).loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js";
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    pyodideInstance = await (window as any).loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/"
    });
  }
  return pyodideInstance;
};

const CustomCodeBlock = (props: any) => {
  const { node: { attrs: { language } }, updateAttributes, extension } = props;
  const isPython = language === 'python';
  const isMermaid = language === 'mermaid';

  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [mermaidSvg, setMermaidSvg] = useState('');
  const mermaidRef = useRef<HTMLDivElement>(null);
  
  const textContent = props.node.textContent;

  useEffect(() => {
    if (isMermaid && textContent.trim()) {
      const renderMermaid = async () => {
        try {
          const isDark = document.documentElement.classList.contains('dark');
          mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' });
          const { svg } = await mermaid.render('mermaid-' + Math.random().toString(36).substr(2, 9), textContent);
          setMermaidSvg(svg);
        } catch (e) {
          console.error("Mermaid error", e);
        }
      };
      renderMermaid();
    }
  }, [textContent, isMermaid]);

  const runPython = async () => {
    setIsRunning(true);
    setOutput('Initializing python environment...');
    try {
      const pyodide = await loadPyodideEngine();
      // capture stdout
      pyodide.setStdout({ batched: (msg: string) => { setOutput(prev => prev + msg + '\n'); } });
      setOutput('');
      const result = await pyodide.runPythonAsync(textContent);
      if (result !== undefined) {
        setOutput(prev => prev + result + '\n');
      }
    } catch (err: any) {
      setOutput(err.toString());
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <NodeViewWrapper className="code-block my-4 relative group rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-slate-300 border-b border-slate-700 select-none">
        <div className="flex items-center gap-2 text-xs font-mono font-medium">
          <Code2 className="w-4 h-4" />
          {language || 'text'}
        </div>
        <div className="flex gap-2">
          {isPython && (
            <button 
              onClick={runPython} 
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded text-xs font-bold transition-colors"
            >
              <Play className="w-3 h-3" />
              {isRunning ? 'Running...' : 'Run Code'}
            </button>
          )}
          <select 
            contentEditable={false}
            value={language} 
            onChange={e => updateAttributes({ language: e.target.value })}
            className="bg-slate-700 text-slate-200 text-xs rounded border border-slate-600 px-2 outline-none"
          >
            <option value="">Plain Text</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="mermaid">Mermaid</option>
            <option value="typescript">TypeScript</option>
          </select>
        </div>
      </div>
      
      {isMermaid && mermaidSvg ? (
        <div className="p-4 bg-white dark:bg-slate-900 flex justify-center items-center overflow-auto" dangerouslySetInnerHTML={{ __html: mermaidSvg }} />
      ) : (
        <pre className="p-4 m-0 bg-transparent text-slate-100 font-mono text-sm overflow-x-auto">
          <code><NodeViewContent className="block min-h-[1.5em]" /></code>
        </pre>
      )}

      {isPython && output && (
        <div className="border-t border-slate-700 bg-black/50 p-4">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-2">
            <Terminal className="w-3 h-3" /> Output
          </div>
          <pre className="text-sm font-mono text-emerald-400 m-0 whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </NodeViewWrapper>
  );
};

export const SmartCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CustomCodeBlock);
  }
});
