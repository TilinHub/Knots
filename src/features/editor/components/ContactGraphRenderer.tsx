import React from 'react';

import type { BoundedCurvatureGraph } from '@/core/geometry/contactGraph';

interface ContactGraphRendererProps {
  graph: BoundedCurvatureGraph;
  visible: boolean;
}

export function ContactGraphRenderer({ graph, visible }: ContactGraphRendererProps) {
  if (!visible || !graph) return null;

  return (
    <g className="contact-graph-edges">
      {graph.edges.map((edge, idx) => (
        <line
          key={`edge-${idx}-${edge.type}`}
          x1={edge.start.x}
          y1={edge.start.y}
          x2={edge.end.x}
          y2={edge.end.y}
          stroke="rgba(100, 100, 100, 0.2)"
          strokeWidth="1"
          strokeDasharray="4 2"
        />
      ))}
    </g>
  );
}
