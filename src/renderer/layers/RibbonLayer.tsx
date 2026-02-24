import React, { useMemo } from 'react';
import type { EnvelopeSegment } from '../../core/geometry/contactGraph';
import { BaseLayer } from './BaseLayer';
import { PathLayer } from './PathLayer';

interface RibbonLayerProps {
    visible: boolean;
    path: EnvelopeSegment[];
    width: number;
    opacity: number;
    showEdges: boolean;
    color?: string;
    context?: { width: number; height: number };
}

// Helper to convert envelope segments to a single closed SVG path
function segmentsToPath(segments: EnvelopeSegment[]): string {
    if (!segments || segments.length === 0) return '';

    return (
        segments
            .map((seg, i) => {
                let startX, startY, endX, endY;

                if (seg.type === 'ARC') {
                    startX = seg.center.x + seg.radius * Math.cos(seg.startAngle);
                    startY = seg.center.y + seg.radius * Math.sin(seg.startAngle);

                    let effEndAngle = seg.endAngle;
                    const isFullCircle = Math.abs(seg.length - 2 * Math.PI * seg.radius) < 1e-4;
                    if (isFullCircle) {
                        effEndAngle += seg.chirality === 'L' ? -0.001 : 0.001;
                    }

                    endX = seg.center.x + seg.radius * Math.cos(effEndAngle);
                    endY = seg.center.y + seg.radius * Math.sin(effEndAngle);
                } else {
                    startX = seg.start.x;
                    startY = seg.start.y;
                    endX = seg.end.x;
                    endY = seg.end.y;
                }

                const move = i === 0 ? `M ${startX} ${startY}` : '';

                if (seg.type === 'ARC') {
                    const largeArc = seg.length > Math.PI * seg.radius ? 1 : 0;
                    const sweep = seg.chirality === 'L' ? 1 : 0;
                    return `${move} A ${seg.radius} ${seg.radius} 0 ${largeArc} ${sweep} ${endX} ${endY}`;
                } else {
                    return `${move} L ${endX} ${endY}`;
                }
            })
            .join(' ') + (segments.length > 2 ? ' Z' : '')
    );
}

export const RibbonLayer: React.FC<RibbonLayerProps> = ({
    visible,
    path,
    width,
    opacity,
    showEdges,
    color = '#F6AD55',
    context,
}) => {
    if (!visible || !path || path.length === 0) return null;

    const { width: canvasWidth = 800, height: canvasHeight = 600 } = context || {};
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    const svgPath = useMemo(() => segmentsToPath(path), [path]);

    return (
        <BaseLayer visible={visible} zIndex={5}>
            <g transform={`translate(${centerX}, ${centerY}) scale(1, -1)`}>
                {/* Ribbon Body (Thick Stroke) */}
                <path
                    d={svgPath}
                    fill="none"
                    stroke={color}
                    strokeWidth={width}
                    strokeOpacity={opacity}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                />

                {/* Ribbon Edges (Optional) */}
                {showEdges && (
                    <>
                        <path
                            d={svgPath}
                            fill="none"
                            stroke={color}
                            strokeWidth={width + 1}
                            strokeOpacity={opacity + 0.2}
                            strokeDasharray={`${width / 5}, ${width / 5}`}
                            style={{ pointerEvents: 'none' }}
                        />
                    </>
                )}
            </g>
        </BaseLayer>
    );
};
