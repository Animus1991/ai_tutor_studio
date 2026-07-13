import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ConceptNode, ConceptEdge } from '../../lib/noteContentExtractors';
import { layoutConceptMap } from '../../lib/conceptMapLayout';

const GROUP_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

const RELATION_STYLE: Record<ConceptEdge['relation'], { stroke: string; dashed: boolean }> = {
  prerequisite: { stroke: '#6366f1', dashed: false },
  related: { stroke: '#94a3b8', dashed: true },
  contrasts: { stroke: '#f43f5e', dashed: true },
};

/**
 * Data-driven, interactive concept map rendered from the workspace note bundle.
 * Replaces the static text list with a real @xyflow graph while preserving the
 * same underlying concept/edge data. Nodes are laid out radially around the
 * highest-degree root so the map is readable without a heavy layout engine.
 */
export default function ConceptMapGraph({
  nodes: conceptNodes,
  edges: conceptEdges,
}: {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}) {
  const { nodes, edges } = useMemo(() => {
    if (conceptNodes.length === 0) return { nodes: [] as Node[], edges: [] as Edge[] };

    const laidOut = layoutConceptMap(conceptNodes, conceptEdges);

    const rfNodes: Node[] = laidOut.map((n) => ({
      id: n.id,
      position: { x: n.x, y: n.y },
      data: { label: n.label },
      style: nodeStyle(n.group, n.isRoot),
    }));

    const rfEdges: Edge[] = conceptEdges.map((e, i) => {
      const rel = RELATION_STYLE[e.relation] ?? RELATION_STYLE.related;
      return {
        id: `e-${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        label: e.relation,
        labelStyle: { fontSize: 9, fill: '#64748b' },
        style: {
          stroke: rel.stroke,
          strokeWidth: 2,
          strokeDasharray: rel.dashed ? '5 5' : undefined,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: rel.stroke },
      };
    });

    return { nodes: rfNodes, edges: rfEdges };
  }, [conceptNodes, conceptEdges]);

  if (conceptNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-500">
        Not enough source structure to build a concept map yet.
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{conceptNodes.length} concepts · {conceptEdges.length} links</span>
        <LegendDot color="#6366f1" label="prerequisite" />
        <LegendDot color="#94a3b8" label="related" dashed />
        <LegendDot color="#f43f5e" label="contrasts" dashed />
      </div>
      <div className="h-[calc(100%-2rem)]">
        <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.2} proOptions={{ hideAttribution: true }}>
          <Controls showInteractive={false} />
          <MiniMap nodeColor={(n) => (n.style?.background as string) ?? '#94a3b8'} maskColor="rgba(0,0,0,0.08)" />
          <Background gap={14} size={1} color="#cbd5e1" />
        </ReactFlow>
      </div>
    </div>
  );
}

function nodeStyle(group: number, isRoot: boolean) {
  const bg = GROUP_COLORS[group % GROUP_COLORS.length];
  return {
    background: bg,
    color: 'white',
    borderRadius: '10px',
    border: isRoot ? '2px solid #fff' : 'none',
    padding: isRoot ? '12px 22px' : '8px 16px',
    fontWeight: 700,
    fontSize: isRoot ? 14 : 12,
    boxShadow: isRoot ? '0 4px 14px rgba(79,70,229,0.35)' : undefined,
  } as const;
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block w-4 h-0"
        style={{ borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }}
      />
      {label}
    </span>
  );
}
