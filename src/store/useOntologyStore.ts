import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../lib/db';

export interface OntologyNode {
  id: string;
  group: number;
  radius: number;
  label: string;
}

export interface OntologyLink {
  source: string;
  target: string;
  value: number;
}

interface OntologyState {
  nodes: OntologyNode[];
  links: OntologyLink[];
  addOntologyData: (nodes: OntologyNode[], links: OntologyLink[]) => void;
}

const initialNodes: OntologyNode[] = [
  { id: 'Macroeconomics', group: 1, radius: 25, label: 'Macroeconomics' },
  { id: 'GDP', group: 1, radius: 15, label: 'GDP' },
  { id: 'Inflation', group: 1, radius: 15, label: 'Inflation' },
  { id: 'Fiscal Policy', group: 1, radius: 15, label: 'Fiscal Policy' },
  { id: 'Monetary Policy', group: 1, radius: 15, label: 'Monetary Policy' },
];

const initialLinks: OntologyLink[] = [
  { source: 'Macroeconomics', target: 'GDP', value: 1 },
  { source: 'Macroeconomics', target: 'Inflation', value: 1 },
  { source: 'GDP', target: 'Fiscal Policy', value: 1 },
  { source: 'Inflation', target: 'Monetary Policy', value: 1 },
];

export const useOntologyStore = create<OntologyState>()(
  persist(
    (set) => ({
      nodes: initialNodes,
      links: initialLinks,
      addOntologyData: (newNodes, newLinks) => set((state) => {
        // Simple merge, avoiding duplicates by id
        const mergedNodes = [...state.nodes];
        for (const nn of newNodes) {
          if (!mergedNodes.find(n => n.id === nn.id)) {
            mergedNodes.push(nn);
          }
        }
        
        const mergedLinks = [...state.links];
        for (const nl of newLinks) {
          if (!mergedLinks.find(l => l.source === nl.source && l.target === nl.target)) {
            mergedLinks.push(nl);
          }
        }

        return { nodes: mergedNodes, links: mergedLinks };
      }),
    }),
    {
      name: 'ontology-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
