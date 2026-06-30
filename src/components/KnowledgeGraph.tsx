import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useOntologyStore, OntologyNode, OntologyLink } from '../store/useOntologyStore';

export default function KnowledgeGraph() {
  const { nodes, links } = useOntologyStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

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

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    const width = dimensions.width;
    const height = dimensions.height;

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('viewBox', [0, 0, width, height]);

    // Add zoom capabilities
    const g = svg.append('g');
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
      
    svg.call(zoom);

    // Dark mode handling for colors
    const isDark = document.documentElement.classList.contains('dark');
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Deep clone nodes and links because d3 mutates them
    const simNodes = nodes.map(d => Object.create(d));
    const simLinks = links.map(d => Object.create(d));

    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius((d: any) => d.radius + 10));

    const link = g.append('g')
      .attr('stroke', isDark ? '#475569' : '#cbd5e1')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke-width', (d: any) => Math.sqrt(d.value) * 1.5)
      .attr('stroke-dasharray', (d: any) => d.value > 1 ? '5,5' : 'none');

    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(simNodes)
      .join('g')
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    nodeGroup.append('circle')
      .attr('r', (d: any) => d.radius)
      .attr('fill', (d: any) => colorScale(d.group.toString()))
      .attr('stroke', isDark ? '#1e293b' : '#ffffff')
      .attr('stroke-width', 2);

    nodeGroup.append('text')
      .text((d: any) => d.label)
      .attr('x', (d: any) => d.radius + 5)
      .attr('y', 4)
      .attr('fill', isDark ? '#f8fafc' : '#0f172a')
      .style('font-family', 'Inter, sans-serif')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeGroup
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [dimensions]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 shadow-sm w-full h-[400px] lg:h-[600px] flex flex-col relative overflow-hidden">
      <div className="flex items-center justify-between z-10 absolute top-6 left-6 right-6 pointer-events-none">
        <div>
          <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-1">Knowledge Graph</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Interactive map of your concepts</p>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing pt-16">
        <svg ref={svgRef} className="w-full h-full" />
      </div>
    </div>
  );
}
