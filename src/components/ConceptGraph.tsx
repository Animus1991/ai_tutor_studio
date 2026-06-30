import { useState, useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import { Info, X } from "lucide-react";

const initialNodes: Node[] = [
  {
    id: "1",
    position: { x: 250, y: 50 },
    data: { label: "Macroeconomics" },
    style: {
      background: "#4f46e5",
      color: "white",
      borderRadius: "8px",
      border: "none",
      padding: "10px 20px",
      fontWeight: "bold",
    },
  },
  {
    id: "2",
    position: { x: 100, y: 150 },
    data: { label: "GDP" },
    style: {
      background: "#0ea5e9",
      color: "white",
      borderRadius: "8px",
      border: "none",
      padding: "10px 20px",
      fontWeight: "bold",
    },
  },
  {
    id: "3",
    position: { x: 400, y: 150 },
    data: { label: "Inflation" },
    style: {
      background: "#0ea5e9",
      color: "white",
      borderRadius: "8px",
      border: "none",
      padding: "10px 20px",
      fontWeight: "bold",
    },
  },
  {
    id: "4",
    position: { x: 400, y: 250 },
    data: { label: "Monetary Policy" },
    style: {
      background: "#10b981",
      color: "white",
      borderRadius: "8px",
      border: "none",
      padding: "10px 20px",
      fontWeight: "bold",
    },
  },
  {
    id: "5",
    position: { x: 100, y: 250 },
    data: { label: "Fiscal Policy" },
    style: {
      background: "#10b981",
      color: "white",
      borderRadius: "8px",
      border: "none",
      padding: "10px 20px",
      fontWeight: "bold",
    },
  },
  {
    id: "6",
    position: { x: 250, y: 350 },
    data: { label: "IS-LM Model" },
    style: {
      background: "#f59e0b",
      color: "white",
      borderRadius: "8px",
      border: "none",
      padding: "10px 20px",
      fontWeight: "bold",
    },
  },
  {
    id: "7",
    position: { x: 600, y: 50 },
    data: { label: "Psychology 101" },
    style: {
      background: "#4f46e5",
      color: "white",
      borderRadius: "8px",
      border: "none",
      padding: "10px 20px",
      fontWeight: "bold",
    },
  },
  {
    id: "8",
    position: { x: 600, y: 150 },
    data: { label: "Cognitive Dissonance" },
    style: {
      background: "#0ea5e9",
      color: "white",
      borderRadius: "8px",
      border: "none",
      padding: "10px 20px",
      fontWeight: "bold",
    },
  },
  {
    id: "9",
    position: { x: 600, y: 250 },
    data: { label: "Behavioral Econ" },
    style: {
      background: "#10b981",
      color: "white",
      borderRadius: "8px",
      border: "none",
      padding: "10px 20px",
      fontWeight: "bold",
    },
  },
];

const defaultEdgeOptions = {
  style: { strokeWidth: 2, stroke: "#94a3b8" },
  type: "smoothstep",
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: "#94a3b8",
  },
};

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", ...defaultEdgeOptions },
  { id: "e1-3", source: "1", target: "3", ...defaultEdgeOptions },
  { id: "e2-5", source: "2", target: "5", ...defaultEdgeOptions },
  { id: "e3-4", source: "3", target: "4", ...defaultEdgeOptions },
  { id: "e4-6", source: "4", target: "6", ...defaultEdgeOptions },
  { id: "e5-6", source: "5", target: "6", ...defaultEdgeOptions },
  { id: "e7-8", source: "7", target: "8", ...defaultEdgeOptions },
  { id: "e8-9", source: "8", target: "9", ...defaultEdgeOptions },
  {
    id: "e1-9",
    source: "1",
    target: "9",
    ...defaultEdgeOptions,
    style: { strokeWidth: 2, stroke: "#94a3b8", strokeDasharray: "5 5" },
  },
];

export default function ConceptGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (params: any) =>
      setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-8 shadow-sm flex flex-col h-[600px] transition-colors duration-300 relative overflow-hidden">
      <div className="flex items-center justify-between mb-6 z-10 relative">
        <div>
          <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-1">
            Knowledge Graph
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Prerequisites & conceptual relationships
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#4f46e5]"></span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Roots
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#0ea5e9]"></span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Core
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#10b981]"></span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Applied
            </span>
          </div>
        </div>
      </div>
      <div className="flex-1 w-full relative bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
          className="dark:bg-slate-800/50"
        >
          <Controls className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg shadow-sm" />
          <MiniMap
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg shadow-sm"
            nodeColor="#e2e8f0"
            maskColor="rgba(0,0,0,0.1)"
          />
          <Background gap={12} size={1} color="#cbd5e1" />
        </ReactFlow>
      </div>

      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-12 right-12 bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-xl border border-slate-200 dark:border-slate-700 max-w-sm z-20"
          >
            <button
              onClick={() => setSelectedNode(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-5 h-5 text-indigo-500" />
              <h4 className="font-bold text-slate-900 dark:text-white text-lg">
                {selectedNode.data.label as string}
              </h4>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Focus on mastering this concept to unlock downstream topics. View
              your notes and recommended materials for{" "}
              {selectedNode.data.label as string}.
            </p>
            <button className="mt-4 w-full py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
              View Study Materials
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
