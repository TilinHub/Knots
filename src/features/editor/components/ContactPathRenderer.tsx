import React from 'react';

import type { EnvelopeSegment } from '@/core/geometry/contactGraph';

interface ContactPathRendererProps {
    path: EnvelopeSegment[];
    visible: boolean;
    color?: string;
    width?: number;
}

export function ContactPathRenderer({ path, visible, color = "#FF4500", width = 4 }: ContactPathRendererProps) {
    if (!visible || !path || path.length === 0) return null;

    return (
        <g className="contact-path-envelope">
            {path.map((seg, idx) => {
                if (seg.type === 'ARC') {
                    // Render Arc
                    const startX = seg.center.x + seg.radius * Math.cos(seg.startAngle);
                    const startY = seg.center.y + seg.radius * Math.sin(seg.startAngle);
                    const endX = seg.center.x + seg.radius * Math.cos(seg.endAngle);
                    const endY = seg.center.y + seg.radius * Math.sin(seg.endAngle);

                    const largeArc = seg.length > Math.PI * seg.radius ? 1 : 0;
                    const sweep = seg.chirality === 'L' ? 1 : 0;

                    const d = `M ${startX} ${startY} A ${seg.radius} ${seg.radius} 0 ${largeArc} ${sweep} ${endX} ${endY}`;

                    return (
                        <path
                            key={`seg-${idx}-arc`}
                            d={d}
                            fill="none"
                            stroke={color}
                            strokeWidth={width}
                            strokeLinecap="round"
                        />
                    );
                } else {
                    // Tangent
                    return (
                        <line
                            key={`seg-${idx}-tan`}
                            x1={seg.start.x}
                            y1={seg.start.y}
                            x2={seg.end.x}
                            y2={seg.end.y}
                            stroke={color}
                            strokeWidth={width}
                            strokeLinecap="round"
                        />
                    );
                }
            })}
        </g>
    );
}
