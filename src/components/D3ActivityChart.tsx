import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface DataPoint {
  day: string;
  studyTime: number; // in minutes
  goalTime: number; // in minutes
}

const mockData: DataPoint[] = [
  { day: 'Mon', studyTime: 45, goalTime: 60 },
  { day: 'Tue', studyTime: 70, goalTime: 60 },
  { day: 'Wed', studyTime: 30, goalTime: 60 },
  { day: 'Thu', studyTime: 90, goalTime: 60 },
  { day: 'Fri', studyTime: 60, goalTime: 60 },
  { day: 'Sat', studyTime: 120, goalTime: 90 },
  { day: 'Sun', studyTime: 0, goalTime: 30 },
];

export default function D3ActivityChart() {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Clear existing chart
    d3.select(chartRef.current).selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 30, left: 40 };
    const width = chartRef.current.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3
      .select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Axis
    const x = d3
      .scaleBand()
      .domain(mockData.map((d) => d.day))
      .range([0, width])
      .padding(0.2);

    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSize(0))
      .attr('color', '#64748b')
      .selectAll('text')
      .attr('dy', '1em');

    // Y Axis
    const maxVal = d3.max(mockData, (d) => Math.max(d.studyTime, d.goalTime)) || 100;
    const y = d3.scaleLinear().domain([0, maxVal * 1.1]).range([height, 0]);

    svg
      .append('g')
      .call(
        d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat((d) => `${d}m`)
      )
      .attr('color', '#64748b')
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .selectAll('.tick line')
          .attr('stroke', '#334155')
          .attr('stroke-opacity', 0.2)
          .attr('stroke-dasharray', '2,2')
      );

    // Tooltip
    const tooltip = d3
      .select(chartRef.current)
      .append('div')
      .style('opacity', 0)
      .attr('class', 'absolute bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none transition-opacity z-10');

    // Goal Time Line
    const line = d3
      .line<DataPoint>()
      .x((d) => (x(d.day) || 0) + x.bandwidth() / 2)
      .y((d) => y(d.goalTime))
      .curve(d3.curveMonotoneX);

    svg
      .append('path')
      .datum(mockData)
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,4')
      .attr('d', line);

    // Study Time Bars
    svg
      .selectAll('.bar')
      .data(mockData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.day) || 0)
      .attr('y', (d) => y(d.studyTime))
      .attr('width', x.bandwidth())
      .attr('height', (d) => height - y(d.studyTime))
      .attr('fill', (d) => d.studyTime >= d.goalTime ? '#10b981' : '#6366f1')
      .attr('rx', 4)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 0.8);
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip
          .html(`Study: ${d.studyTime}m<br/>Goal: ${d.goalTime}m`)
          .style('left', `${event.pageX - 30}px`)
          .style('top', `${event.pageY - 40}px`);
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 1);
        tooltip.transition().duration(500).style('opacity', 0);
      });

    // Add legend
    const legend = svg.append('g').attr('transform', `translate(0, -10)`);
    
    legend.append('rect').attr('x', 0).attr('y', 0).attr('width', 10).attr('height', 10).attr('fill', '#10b981').attr('rx', 2);
    legend.append('text').attr('x', 15).attr('y', 9).text('Goal Met').style('font-size', '10px').attr('fill', '#64748b');

    legend.append('rect').attr('x', 70).attr('y', 0).attr('width', 10).attr('height', 10).attr('fill', '#6366f1').attr('rx', 2);
    legend.append('text').attr('x', 85).attr('y', 9).text('Study Time').style('font-size', '10px').attr('fill', '#64748b');
    
    legend.append('line').attr('x1', 150).attr('y1', 5).attr('x2', 170).attr('y2', 5).attr('stroke', '#94a3b8').attr('stroke-width', 2).attr('stroke-dasharray', '2,2');
    legend.append('text').attr('x', 175).attr('y', 9).text('Target Goal').style('font-size', '10px').attr('fill', '#64748b');

  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-3xl shadow-sm mb-8">
      <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white mb-2">Weekly Activity</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Time spent studying vs your daily goals.</p>
      <div ref={chartRef} className="w-full h-[300px] relative" />
    </div>
  );
}
