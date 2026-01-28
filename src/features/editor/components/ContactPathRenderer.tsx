import React from 'react';
import type { EnvelopeSegment } from '@/core/geometry/contactGraph';

interface ContactPathRendererProps {
    path: EnvelopeSegment[];
    visible: boolean;
}

export function ContactPathRenderer({ path, visible }: ContactPathRendererProps) {
    if (!visible || !path || path.length === 0) return null;

    return (
        <g className="contact-path-envelope">
            {path.map((seg, idx) => {
                if (seg.type === 'ARC') {
                    // Render Arc
                    // SVG Path for Arc: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
                    const startX = seg.center.x + seg.radius * Math.cos(seg.startAngle);
                    const startY = seg.center.y + seg.radius * Math.sin(seg.startAngle);
                    const endX = seg.center.x + seg.radius * Math.cos(seg.endAngle);
                    const endY = seg.center.y + seg.radius * Math.sin(seg.endAngle);

                    // Flags
                    const largeArc = seg.length > Math.PI * seg.radius ? 1 : 0;
                    // Sweep: L (CCW) -> 0 in SVG Y-Down? No.
                    // Standard Math: L=CCW.
                    // SVG Y-Down: +Angle is CW visually?
                    // Let's rely on standard math coordinates since we flip Y in CSCanvas.
                    const sweep = seg.chirality === 'L' ? 1 : 0; // Standard CCW=1

                    const d = `M ${startX} ${startY} A ${seg.radius} ${seg.radius} 0 ${largeArc} ${sweep} ${endX} ${endY}`;

                    return (
                        <path
                            key={`seg-${idx}-arc`}
                            d={d}
                            fill="none"
                            stroke="#FF4500" // OrangeRed
                            strokeWidth="4"
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
                            stroke="#FF4500"
                            strokeWidth="4"
                            strokeLinecap="round"
                        />
                    );
                }
            })}
        </g>
    );
}
