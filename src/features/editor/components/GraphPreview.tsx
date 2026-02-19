import { useMemo } from 'react';

import { graphToContactScene } from '../../../core/geometry/contactLayout';
import type { Graph } from '../../../io/parseGraph6';

interface GraphPreviewProps {
    graph: Graph;
    size?: number;
    color?: string;
    showEdges?: boolean;
}

export const GraphPreview = ({ graph, size = 100, color = 'var(--accent-primary)', showEdges = true }: GraphPreviewProps) => {

    // Compute layout once
    const { nodes, edges } = useMemo(() => {
        // Run a lightweight simulation for preview
        const scene = graphToContactScene(graph, 10, {
            iterations: 1000,
            jitter: 0.5,
            repelK: 1.0,
            edgeK: 0.1
        });

        // Normalize coordinates to fit in viewbox 0 0 100 100
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        scene.points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });

        const padding = 10;
        const width = maxX - minX || 1;
        const height = maxY - minY || 1;
        const scale = Math.min((size - 2 * padding) / width, (size - 2 * padding) / height);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const mappedNodes = scene.points.map(p => ({
            x: size / 2 + (p.x - centerX) * scale,
            y: size / 2 + (p.y - centerY) * scale
        }));

        const mappedEdges = graph.edges.map(([i, j]) => ({
            x1: mappedNodes[i].x,
            y1: mappedNodes[i].y,
            x2: mappedNodes[j].x,
            y2: mappedNodes[j].y
        }));

        return { nodes: mappedNodes, edges: mappedEdges };
    }, [graph, size]);

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
            {showEdges && edges.map((e, i) => (
                <line
                    key={i}
                    x1={e.x1} y1={e.y1}
                    x2={e.x2} y2={e.y2}
                    stroke={color}
                    strokeWidth="1"
                    opacity="0.4"
                />
            ))}
            {nodes.map((n, i) => (
                <circle
                    key={i}
                    cx={n.x}
                    cy={n.y}
                    r={3}
                    fill={color}
                />
            ))}
        </svg>
    );
};
