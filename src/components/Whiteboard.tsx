import { useEffect, useState, useRef, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Text, Group } from 'react-konva';
import * as Y from 'yjs';
import { Pen, Eraser, Trash2, StickyNote, Move, Wand2, Download, Keyboard } from 'lucide-react';
import * as d3 from 'd3';
import { toast } from 'sonner';
import { moderateBoardText } from '../lib/socialPolicy';

interface Stroke {
  id: string;
  points: number[];
  color: string;
  size: number;
  tool: 'pen' | 'eraser';
}

interface BoardNode {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

export default function Whiteboard({ ydoc }: { ydoc: Y.Doc }) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [nodes, setNodes] = useState<BoardNode[]>([]);
  const [tool, setTool] = useState<'pen' | 'eraser' | 'node' | 'move'>('pen');
  const [color, setColor] = useState('#6366f1'); // Indigo 500
  const isDrawing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const yStrokes = useRef<Y.Map<Stroke> | null>(null);
  const yNodes = useRef<Y.Map<BoardNode> | null>(null);

  useEffect(() => {
    yStrokes.current = ydoc.getMap<Stroke>('strokes');
    yNodes.current = ydoc.getMap<BoardNode>('nodes');

    const updateState = () => {
      if (yStrokes.current) setStrokes(Array.from(yStrokes.current.values()));
      if (yNodes.current) setNodes(Array.from(yNodes.current.values()));
    };

    yStrokes.current.observe(updateState);
    yNodes.current.observe(updateState);
    
    updateState(); // Initial load

    return () => {
      yStrokes.current?.unobserve(updateState);
      yNodes.current?.unobserve(updateState);
    };
  }, [ydoc]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (entries.length > 0) {
        setDimensions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const clearBoard = useCallback(() => {
    if (yStrokes.current) yStrokes.current.clear();
    if (yNodes.current) yNodes.current.clear();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement || 
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) return;
      
      switch (e.key.toLowerCase()) {
        case 'v': setTool('move'); break;
        case 'p': setTool('pen'); break;
        case 'e': setTool('eraser'); break;
        case 'n': setTool('node'); break;
        case 'c': clearBoard(); break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearBoard]);

  const getRelativePointerPosition = (stage: any) => {
    const pointer = stage.getPointerPosition();
    const scale = stage.scaleX();
    return {
      x: (pointer.x - stage.x()) / scale,
      y: (pointer.y - stage.y()) / scale
    };
  };

  const handleMouseDown = (e: any) => {
    // Prevent drawing if dragging a node or panning
    if (e.target.name() === 'node' || e.target.name() === 'node-text') return;
    if (tool === 'move') return;

    const pos = getRelativePointerPosition(e.target.getStage());
    const id = Date.now().toString() + Math.random().toString(36).substring(7);

    if (tool === 'node') {
      const newNode: BoardNode = {
        id,
        x: pos.x - 50,
        y: pos.y - 50,
        text: 'New Idea...',
        color
      };
      if (yNodes.current) {
        yNodes.current.set(id, newNode);
      }
      setTool('move'); // auto switch to move after creating
      return;
    }
    
    isDrawing.current = true;
    
    const newStroke: Stroke = {
      id,
      points: [pos.x, pos.y],
      color: tool === 'eraser' ? '#ffffff' : color,
      size: tool === 'eraser' ? 20 : 3,
      tool: tool as 'pen' | 'eraser'
    };
    
    if (yStrokes.current) {
      yStrokes.current.set(id, newStroke);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || !yStrokes.current || tool === 'move' || tool === 'node') return;
    
    const stage = e.target.getStage();
    const point = getRelativePointerPosition(stage);
    
    const currentStrokes = Array.from(yStrokes.current.values());
    if (currentStrokes.length === 0) return;
    
    const lastStroke = currentStrokes[currentStrokes.length - 1] as Stroke;
    
    const updatedStroke: Stroke = {
      ...lastStroke,
      points: [...lastStroke.points, point.x, point.y]
    };
    
    yStrokes.current.set(lastStroke.id, updatedStroke);
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const handleDragMove = (e: any, id: string) => {
    if (!yNodes.current) return;
    const node = yNodes.current.get(id);
    if (node) {
      yNodes.current.set(id, {
        ...node,
        x: e.target.x(),
        y: e.target.y()
      });
    }
  };

  const handleDragEnd = (e: any, id: string) => {
    if (!yNodes.current) return;
    const node = yNodes.current.get(id);
    if (node) {
      yNodes.current.set(id, {
        ...node,
        x: e.target.x(),
        y: e.target.y()
      });
    }
  };

  const handleEditNodeText = async (id: string) => {
    if (!yNodes.current) return;
    const node = yNodes.current.get(id);
    if (!node) return;
    const next = window.prompt('Sticky note text', node.text);
    if (next === null) return;
    const trimmed = next.trim().slice(0, 280);
    if (!trimmed) return;
    const mod = await moderateBoardText(trimmed);
    if (!mod.allowed) {
      toast.error(mod.reason || 'Board text blocked by safety filter');
      return;
    }
    yNodes.current.set(id, { ...node, text: trimmed });
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();

    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleCleanup = () => {
    if (!yNodes.current || nodes.length === 0) return;
    
    const simNodes = nodes.map(n => ({ ...n, x: n.x + 50, y: n.y + 50 }));
    const simulation = d3.forceSimulation(simNodes as any)
      .force('charge', d3.forceManyBody().strength(-500))
      .force('collide', d3.forceCollide().radius(70))
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .stop();
      
    for (let i = 0; i < 150; ++i) simulation.tick();
    
    ydoc.transact(() => {
      simNodes.forEach((sn: any) => {
        const id = sn.id;
        const existing = yNodes.current!.get(id);
        if (existing) {
          yNodes.current!.set(id, {
            ...existing,
            x: sn.x - 50,
            y: sn.y - 50
          });
        }
      });
    });
  };

  const handleExport = () => {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate minimap bounds
  let minX = 0, minY = 0, maxX = dimensions.width || 800, maxY = dimensions.height || 600;
  if (strokes.length > 0 || nodes.length > 0) {
    strokes.forEach(s => {
      for(let i=0; i<s.points.length; i+=2) {
        minX = Math.min(minX, s.points[i]);
        minY = Math.min(minY, s.points[i+1]);
        maxX = Math.max(maxX, s.points[i]);
        maxY = Math.max(maxY, s.points[i+1]);
      }
    });
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 100);
      maxY = Math.max(maxY, n.y + 100);
    });
  }
  minX -= 100; minY -= 100; maxX += 100; maxY += 100;
  const w = maxX - minX;
  const h = maxY - minY;

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 relative flex flex-col" style={{ minHeight: '500px' }}>
      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 rounded-xl p-2 flex items-center gap-2 z-10">
        <button
          onClick={() => setTool('move')}
          className={`p-2 rounded-lg transition-colors ${tool === 'move' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          title="Move/Pan (V)"
        >
          <Move className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTool('pen')}
          className={`p-2 rounded-lg transition-colors ${tool === 'pen' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          title="Pen (P)"
        >
          <Pen className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={`p-2 rounded-lg transition-colors ${tool === 'eraser' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          title="Eraser (E)"
        >
          <Eraser className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTool('node')}
          className={`p-2 rounded-lg transition-colors ${tool === 'node' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          title="Sticky Note (N)"
        >
          <StickyNote className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#1e293b'].map((c) => (
          <button
            key={c}
            onClick={() => { setColor(c); if(tool === 'eraser') setTool('pen'); }}
            className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c && tool !== 'eraser' ? 'scale-110 border-slate-400 dark:border-slate-300' : 'border-transparent hover:scale-110'}`}
            style={{ backgroundColor: c }}
          />
        ))}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        <button
          onClick={handleCleanup}
          className="p-2 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
          title="Organize Nodes"
        >
          <Wand2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleExport}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="Export as PNG"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={clearBoard}
          className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="Clear Board (C)"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Keyboard Shortcuts Overlay */}
      <div className="absolute bottom-4 left-4 z-10">
        <button onClick={() => setShowShortcuts(!showShortcuts)} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          <Keyboard className="w-4 h-4" />
        </button>
        {showShortcuts && (
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="font-semibold text-slate-900 dark:text-white mb-2">Keyboard Shortcuts</div>
            <div className="flex justify-between py-1"><span>Move/Pan</span><kbd className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 font-mono text-xs">V</kbd></div>
            <div className="flex justify-between py-1"><span>Pen Tool</span><kbd className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 font-mono text-xs">P</kbd></div>
            <div className="flex justify-between py-1"><span>Eraser</span><kbd className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 font-mono text-xs">E</kbd></div>
            <div className="flex justify-between py-1"><span>Add Node</span><kbd className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 font-mono text-xs">N</kbd></div>
            <div className="flex justify-between py-1 border-t border-slate-100 dark:border-slate-700 mt-1 pt-1"><span>Clear Board</span><kbd className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 font-mono text-xs">C</kbd></div>
          </div>
        )}
      </div>

      {/* Minimap Overlay */}
      <div className="absolute bottom-4 right-4 w-40 h-28 bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden z-10 pointer-events-none">
        <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="w-full h-full opacity-60">
          {strokes.map(s => (
            <polyline key={s.id} points={s.points.reduce((acc, p, i) => acc + (i%2===0 ? p + ',' : p + ' '), '')} stroke={s.color} strokeWidth={Math.max(s.size * 2, w / 150)} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {nodes.map(n => (
            <rect key={n.id} x={n.x} y={n.y} width={100} height={100} fill={n.color} rx={8} />
          ))}
          {/* Viewport Box */}
          <rect 
            x={(0 - stagePos.x) / stageScale}
            y={(0 - stagePos.y) / stageScale}
            width={dimensions.width / stageScale}
            height={dimensions.height / stageScale}
            fill="rgba(99, 102, 241, 0.1)"
            stroke="#6366f1"
            strokeWidth={w / 100}
            rx={w / 200}
          />
        </svg>
      </div>

      {/* Canvas Area */}
      <div ref={containerRef} className="flex-1 w-full relative z-0" style={{ touchAction: 'none' }}>
        {/* Subtle grid background that moves with panning */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-10"
          style={{
            backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)',
            backgroundSize: `${20 * stageScale}px ${20 * stageScale}px`,
            backgroundPosition: `${stagePos.x}px ${stagePos.y}px`
          }}
        />
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Stage
            width={dimensions.width}
            height={dimensions.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            onWheel={handleWheel}
            draggable={tool === 'move'}
            onDragEnd={(e) => {
              if (e.target === e.target.getStage()) {
                setStagePos({ x: e.target.x(), y: e.target.y() });
              }
            }}
            x={stagePos.x}
            y={stagePos.y}
            scaleX={stageScale}
            scaleY={stageScale}
            ref={stageRef}
          >
            <Layer>
              {strokes.map((stroke) => (
                <Line
                  key={stroke.id}
                  points={stroke.points}
                  stroke={document.documentElement.classList.contains('dark') && stroke.tool === 'eraser' ? '#0f172a' : stroke.color}
                  strokeWidth={stroke.size}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={
                    stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
                  }
                />
              ))}
              {nodes.map((node) => (
                <Group
                  key={node.id}
                  x={node.x}
                  y={node.y}
                  draggable={tool === 'move' || tool === 'pen'}
                  onDragMove={(e) => handleDragMove(e, node.id)}
                  onDragEnd={(e) => handleDragEnd(e, node.id)}
                  onDblClick={() => void handleEditNodeText(node.id)}
                  onDblTap={() => void handleEditNodeText(node.id)}
                >
                  <Rect
                    name="node"
                    width={100}
                    height={100}
                    fill={node.color}
                    cornerRadius={8}
                    shadowColor="rgba(0,0,0,0.2)"
                    shadowBlur={10}
                    shadowOffset={{ x: 2, y: 2 }}
                    shadowOpacity={0.5}
                    opacity={0.9}
                  />
                  <Text
                    name="node-text"
                    text={node.text}
                    width={100}
                    height={100}
                    fill="#ffffff"
                    padding={10}
                    align="center"
                    verticalAlign="middle"
                    fontSize={14}
                    fontFamily="Inter, sans-serif"
                    fontStyle="bold"
                  />
                </Group>
              ))}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
}
