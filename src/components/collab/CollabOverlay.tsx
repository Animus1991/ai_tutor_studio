import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MousePointer2, StickyNote, Plus, X, Check } from 'lucide-react';
import type * as Y from 'yjs';
import type { WebsocketProvider } from 'y-websocket';

interface Props {
  ydoc: Y.Doc;
  provider: WebsocketProvider | null;
  selfName: string;
  selfColor: string;
}

interface Note { id: string; x: number; y: number; text: string; color: string; author: string }
interface Cursor { x: number; y: number; name: string; color: string }

const NOTE_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe'];

export default function CollabOverlay({ ydoc, provider, selfName, selfColor }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [placing, setPlacing] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const yNotes = useMemo(() => ydoc.getArray<Note>('annotations'), [ydoc]);

  // Shared annotations (Y.Array) → state
  useEffect(() => {
    const sync = () => setNotes(yNotes.toArray());
    sync();
    yNotes.observe(sync);
    return () => yNotes.unobserve(sync);
  }, [yNotes]);

  // Live cursors via awareness
  useEffect(() => {
    if (!provider) return;
    const awareness = provider.awareness;
    const onChange = () => {
      const list: Cursor[] = [];
      awareness.getStates().forEach((state: Record<string, unknown>, clientId: number) => {
        if (clientId === awareness.clientID) return;
        const c = state.cursor as Cursor | undefined;
        const u = state.user as { name?: string; color?: string } | undefined;
        if (c && typeof c.x === 'number') {
          list.push({ x: c.x, y: c.y, name: u?.name || c.name || 'Peer', color: u?.color || c.color || '#6366f1' });
        }
      });
      setCursors(list);
    };
    awareness.on('change', onChange);
    onChange();
    return () => awareness.off('change', onChange);
  }, [provider]);

  const broadcastCursor = useCallback((clientX: number, clientY: number) => {
    if (!provider || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    provider.awareness.setLocalStateField('cursor', { x, y, name: selfName, color: selfColor });
  }, [provider, selfName, selfColor]);

  useEffect(() => {
    let last = 0;
    const onMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - last < 40) return;
      last = now;
      broadcastCursor(e.clientX, e.clientY);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [broadcastCursor]);

  const handleClick = (e: React.MouseEvent) => {
    if (!placing || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const note: Note = {
      id: crypto.randomUUID(), x, y, text: '',
      color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
      author: selfName,
    };
    yNotes.push([note]);
    setEditing(note.id);
    setPlacing(false);
  };

  const updateNote = (id: string, patch: Partial<Note>) => {
    const arr = yNotes.toArray();
    const idx = arr.findIndex((n) => n.id === id);
    if (idx === -1) return;
    ydoc.transact(() => {
      yNotes.delete(idx, 1);
      yNotes.insert(idx, [{ ...arr[idx], ...patch }]);
    });
  };

  const deleteNote = (id: string) => {
    const idx = yNotes.toArray().findIndex((n) => n.id === id);
    if (idx !== -1) yNotes.delete(idx, 1);
  };

  return (
    <div
      ref={ref}
      onClick={handleClick}
      className="absolute inset-0 z-40"
      style={{ pointerEvents: placing ? 'auto' : 'none', cursor: placing ? 'crosshair' : 'default' }}
      data-testid="collab-overlay"
    >
      {/* Toolbar */}
      <div className="absolute top-3 left-3 flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
        <button
          onClick={(e) => { e.stopPropagation(); setPlacing((p) => !p); }}
          data-testid="add-annotation-btn"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-lg backdrop-blur-md border transition-colors ${
            placing ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-white/40 dark:border-slate-700'
          }`}
          title="Place a shared sticky note"
        >
          {placing ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><StickyNote className="w-3.5 h-3.5" /> Annotate</>}
        </button>
        {cursors.length > 0 && (
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 shadow backdrop-blur-md border border-white/40 dark:border-slate-700">
            <MousePointer2 className="w-3 h-3" /> {cursors.length} live
          </span>
        )}
      </div>

      {/* Remote cursors */}
      <AnimatePresence>
        {cursors.map((c, i) => (
          <motion.div
            key={`${c.name}-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 40, mass: 0.4 }}
            className="absolute -translate-x-1 -translate-y-1"
            style={{ pointerEvents: 'none' }}
          >
            <MousePointer2 className="w-4 h-4 drop-shadow" style={{ color: c.color, fill: c.color }} />
            <span className="ml-3 -mt-1 inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white shadow" style={{ backgroundColor: c.color }}>
              {c.name}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Sticky annotations */}
      {notes.map((n) => (
        <motion.div
          key={n.id}
          drag
          dragMomentum={false}
          onDragEnd={(_, info) => {
            if (!ref.current) return;
            const rect = ref.current.getBoundingClientRect();
            updateNote(n.id, {
              x: Math.min(1, Math.max(0, n.x + info.offset.x / rect.width)),
              y: Math.min(1, Math.max(0, n.y + info.offset.y / rect.height)),
            });
          }}
          className="absolute w-40 rounded-lg shadow-xl p-2 text-xs text-slate-800"
          style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%`, backgroundColor: n.color, pointerEvents: 'auto' }}
          data-testid="annotation-note"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold uppercase tracking-wide opacity-60">{n.author}</span>
            <div className="flex gap-1">
              {editing === n.id && (
                <button onClick={() => setEditing(null)} className="opacity-60 hover:opacity-100"><Check className="w-3 h-3" /></button>
              )}
              <button onClick={() => deleteNote(n.id)} className="opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
            </div>
          </div>
          {editing === n.id ? (
            <textarea
              autoFocus
              value={n.text}
              onChange={(e) => updateNote(n.id, { text: e.target.value })}
              onBlur={() => setEditing(null)}
              className="w-full bg-transparent resize-none outline-none text-xs min-h-[48px]"
              placeholder="Type a note…"
            />
          ) : (
            <p onDoubleClick={() => setEditing(n.id)} className="whitespace-pre-wrap break-words min-h-[24px] cursor-text">
              {n.text || <span className="opacity-40">Double-click to edit</span>}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
}
