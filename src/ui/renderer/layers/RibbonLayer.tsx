import React, { useMemo } from 'react';
import type { EnvelopeSegment } from '../../../core/geometry/envelope/contactGraph';
import { BaseLayer } from './BaseLayer';
import { PathLayer } from './PathLayer';

interface RibbonLayerProps {
    visible: boolean;
    path: EnvelopeSegment[];
    savedPaths?: { id: string; color: string; path: EnvelopeSegment[] }[];
    width: number;
    opacity: number;
    showCenterPath: boolean; // Renamed from showEdges
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
    savedPaths = [],
    width,
    opacity,
    showCenterPath,
    color = '#EAF4FC', // Light blue fill matching paper
    context,
}) => {
    if (!visible) return null;
    if ((!path || path.length === 0) && (!savedPaths || savedPaths.length === 0)) return null;

    const { width: canvasWidth = 800, height: canvasHeight = 600 } = context || {};
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    const svgPath = useMemo(() => segmentsToPath(path), [path]);

    return (
        <BaseLayer visible={visible} zIndex={5}>
            <g transform={`translate(${centerX}, ${centerY}) scale(1, -1)`}>
                <defs>
                    <mask id="ribbon-mask">
                        {/* 1. White everywhere to show the outline */}
                        <rect x="-5000" y="-5000" width="10000" height="10000" fill="white" />
                        {/* 2. Black precisely on the inner path so the outline gets a hole */}
                        <path
                            d={svgPath}
                            fill="none"
                            stroke="black"
                            strokeWidth={width}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                        {/* Mask out saved paths too */}
                        {savedPaths.map((saved) => (
                            <path
                                key={`mask-saved-${saved.id}`}
                                d={segmentsToPath(saved.path)}
                                fill="none"
                                stroke="black"
                                strokeWidth={width}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        ))}
                    </mask>
                </defs>

                {/* --- 1. OUTLINE LAYER --- */}
                {/* Drawn identically but with the center masked out entirely! */}
                <g mask="url(#ribbon-mask)">
                    {/* Active Ribbon Outline */}
                    <path
                        d={svgPath}
                        fill="none"
                        stroke="black"
                        strokeWidth={width + 2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        style={{ pointerEvents: 'none' }}
                    />
                    {/* Saved Ribbons Outlines */}
                    {savedPaths.map((saved) => (
                        <path
                            key={`outline-saved-${saved.id}`}
                            d={segmentsToPath(saved.path)}
                            fill="none"
                            stroke="black"
                            strokeWidth={width + 2}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            style={{ pointerEvents: 'none' }}
                        />
                    ))}
                </g>

                {/* --- 2. TRANSPARENT BODY LAYER --- */}
                {/* Drawn inside the hole left by the mask */}
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

                {savedPaths.map((saved) => (
                    <path
                        key={`body-saved-${saved.id}`}
                        d={segmentsToPath(saved.path)}
                        fill="none"
                        stroke={color}
                        strokeWidth={width}
                        strokeOpacity={opacity}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        style={{ pointerEvents: 'none' }}
                    />
                ))}

                {/* --- 3. CENTER PATH (Always 100% Solid Black Dotted) --- */}
                {showCenterPath && (
                    <>
                        <path
                            d={svgPath}
                            fill="none"
                            stroke="black"
                            strokeWidth={1.5}
                            strokeOpacity={1}
                            strokeDasharray="4, 4"
                            style={{ pointerEvents: 'none' }}
                        />
                        {savedPaths.map((saved) => (
                            <path
                                key={`center-saved-${saved.id}`}
                                d={segmentsToPath(saved.path)}
                                fill="none"
                                stroke="black"
                                strokeWidth={1.5}
                                strokeOpacity={1}
                                strokeDasharray="4, 4"
                                style={{ pointerEvents: 'none' }}
                            />
                        ))}
                    </>
                )}
            </g>
        </BaseLayer>
    );
};
