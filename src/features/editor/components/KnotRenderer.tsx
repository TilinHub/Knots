import React from 'react';

import type { KnotDiagram, Point3D } from '@/core/types/knot';

interface KnotRendererProps {
    knot: KnotDiagram;
    showControlPoints?: boolean;
    onSegmentClick?: (index: number, point: Point3D) => void;
}

export function KnotRenderer({ knot, showControlPoints = false, onSegmentClick }: KnotRendererProps) {
    const points = knot.embedding.controlPoints;

    if (!points || points.length < 2) return null;

    // We render individual segments to allow interaction
    return (
        <g className="knot-renderer">
            {points.map((p, i) => {
                const nextIndex = (i + 1) % points.length;
                const nextP = points[nextIndex];

                return (
                    <line
                        key={`seg-${i}`}
                        x1={p.x}
                        y1={p.y}
                        x2={nextP.x}
                        y2={nextP.y}
                        stroke="#FF6B6B"
                        strokeWidth="4"
                        strokeLinecap="round"
                        onClick={(e) => {
                            e.stopPropagation();
                            onSegmentClick?.(i, p);
                        }}
                        style={{ cursor: 'pointer' }}
                    />
                );
            })}

            {/* Crossings will be rendered here */}
            {knot.crossings.map(crossing => (
                <circle
                    key={crossing.id}
                    cx={crossing.position.x}
                    cy={crossing.position.y}
                    r={5}
                    fill="red"
                />
            ))}

            {/* Control Points (Debug) */}
            {showControlPoints && points.map((p, i) => (
                <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={2}
                    fill="#333"
                    opacity={0.5}
                />
            ))}
        </g>
    );
}
