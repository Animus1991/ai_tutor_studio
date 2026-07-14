/**
 * Concept Map Layout — hierarchical tiers (BFS depth from root via
 * prerequisite edges) combined with a force-directed simulation to
 * spread nodes apart within/across tiers and avoid overlap.
 */
import { forceSimulation, forceManyBody, forceLink, forceCollide, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
import type { ConceptEdge, ConceptNode } from './noteContentExtractors';

export interface LaidOutNode {
  id: string;
  label: string;
  group: number;
  x: number;
  y: number;
  depth: number;
  isRoot: boolean;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  depth: number;
}

const TIER_HEIGHT = 160;
const NODE_SPACING = 190;

export function layoutConceptMap(nodes: ConceptNode[], edges: ConceptEdge[]): LaidOutNode[] {
  if (nodes.length === 0) return [];

  // Build adjacency (undirected, weighted toward prerequisite direction for depth calc).
  const adjacency = new Map<string, string[]>();
  const prereqChildren = new Map<string, string[]>(); // source -> targets (prerequisite of)
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) {
    adjacency.get(e.source)?.push(e.target);
    adjacency.get(e.target)?.push(e.source);
    if (e.relation === 'prerequisite') {
      if (!prereqChildren.has(e.source)) prereqChildren.set(e.source, []);
      prereqChildren.get(e.source)!.push(e.target);
    }
  }

  // Root = highest-degree node (most connected / foundational).
  const degree = new Map<string, number>();
  for (const n of nodes) degree.set(n.id, adjacency.get(n.id)?.length ?? 0);
  const root = [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0];

  // BFS depth (tier) from root using all edges as undirected graph.
  const depth = new Map<string, number>();
  depth.set(root.id, 0);
  const queue = [root.id];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const d = depth.get(cur)!;
    for (const neighbor of adjacency.get(cur) ?? []) {
      if (!depth.has(neighbor)) {
        depth.set(neighbor, d + 1);
        queue.push(neighbor);
      }
    }
  }
  // Any disconnected nodes go in the last tier.
  let maxDepth = 0;
  for (const d of depth.values()) maxDepth = Math.max(maxDepth, d);
  for (const n of nodes) {
    if (!depth.has(n.id)) depth.set(n.id, maxDepth + 1);
  }

  // Initial x position within each tier (evenly spaced), y from tier depth.
  const tierGroups = new Map<number, string[]>();
  for (const n of nodes) {
    const d = depth.get(n.id) ?? 0;
    if (!tierGroups.has(d)) tierGroups.set(d, []);
    tierGroups.get(d)!.push(n.id);
  }

  const simNodes: SimNode[] = nodes.map((n) => {
    const d = depth.get(n.id) ?? 0;
    const tier = tierGroups.get(d)!;
    const idxInTier = tier.indexOf(n.id);
    const tierWidth = tier.length * NODE_SPACING;
    return {
      id: n.id,
      depth: d,
      x: idxInTier * NODE_SPACING - tierWidth / 2 + Math.random() * 20,
      y: d * TIER_HEIGHT,
    };
  });

  const simEdges = edges.map((e) => ({ source: e.source, target: e.target }));

  // Force simulation: keep y pinned to tier (forceY strong), spread x (repulsion + collision).
  const sim = forceSimulation(simNodes)
    .force('charge', forceManyBody().strength(-220))
    .force('link', forceLink(simEdges).id((d: SimulationNodeDatum) => (d as SimNode).id).distance(120).strength(0.3))
    .force('collide', forceCollide().radius(70))
    .force('y', forceY((d: SimulationNodeDatum) => (d as SimNode).depth * TIER_HEIGHT).strength(0.9))
    .force('x', forceX(0).strength(0.02))
    .stop();

  for (let i = 0; i < 220; i++) sim.tick();

  const positioned = new Map(simNodes.map((n) => [n.id, n]));

  return nodes.map((n) => {
    const sn = positioned.get(n.id)!;
    return {
      id: n.id,
      label: n.label,
      group: n.group,
      x: sn.x ?? 0,
      y: sn.y ?? 0,
      depth: depth.get(n.id) ?? 0,
      isRoot: n.id === root.id,
    };
  });
}
