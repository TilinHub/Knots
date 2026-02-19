import React, { useMemo } from 'react';

import { type Config, type DubinsPath, sampleDubinsPath } from '@/core/geometry/dubins';

interface DubinsRendererProps {
    // Legacy / candidates
    paths?: DubinsPath[];
    startConfig?: Config | null;
    endConfig?: Config | null;
    visibleTypes?: Set<string>;
    overrideColor?: string; // [NEW] Allow manual color override
    width?: number; // [NEW] Allow manual width

    // New Interactive Props
    candidates?: DubinsPath[];
    selectedPaths?: DubinsPath[];
    onPathClick?: (path: DubinsPath) => void;
    hoverPathType?: string | null;
    onPathHover?: (type: string | null) => void;
}

const PathColors: Record<string, string> = {
    'LSL': '#FF6B6B',
    'RSR': '#4ECDC4',
    'LSR': '#45B7D1',
    'RSL': '#FFA07A',
    'RLR': '#96CEB4',
    'LRL': '#FFEEAD'
};

export function DubinsRenderer({
    paths = [],
    candidates = [],
    selectedPaths = [],
    visibleTypes,
    overrideColor,
    width,
    onPathClick,
    hoverPathType,
    onPathHover
}: DubinsRendererProps) {

    // Combine legacy paths with candidates if needed, or just treat 'paths' as legacy display
    // We'll prioritize the new 'candidates' and 'selectedPaths' props if present.

    return (
        <g className="dubins-renderer">
            {/* 1. SELECTED PATHS (Solid, Permanent) */}
            {selectedPaths.map((path, idx) => {
                const points = sampleDubinsPath(path, 5);
                const d = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

                // Detect potential physical overlap (Distance < Sum of Radii)
                // Assuming standard rho for both if not specified, or sum of rhoStart/rhoEnd.
                // For LSL/RSR (outer), length is roughly distance.
                // If length < (rhoStart + rhoEnd), it physically implies overlap if they are straight connections.
                const r1 = path.rhoStart ?? path.rho;
                const r2 = path.rhoEnd ?? path.rho;

                // Only warn for Outer Tangents (LSL, RSR)
                // Inner tangents (LSR, RSL) naturally have length < Distance, 
                // so checking against Sum of Radii produces false positives when disks are separated.
                const isOuter = path.type === 'LSL' || path.type === 'RSR';
                const isOverlapping = isOuter && (path.length < (r1 + r2) - 0.1);

                const labelColor = isOverlapping ? '#FF4500' : PathColors[path.type]; // Red-Orange if overlapping
                const labelText = (path.length / 50).toFixed(2);

                return (
                    <g key={`selected-${path.type}-${idx}-${path.length}`}>
                        {/* Glow/Highlight background */}
                        <path
                            d={d}
                            stroke={isOverlapping ? '#FF0000' : PathColors[path.type]}
                            strokeWidth="4"
                            opacity="0.3"
                            fill="none"
                        />
                        <path
                            d={d}
                            fill="none"
                            stroke={isOverlapping ? '#FF0000' : (PathColors[path.type] || '#333')}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeDasharray={path.type.includes('S') ? undefined : "5,5"}
                        />
                        {/* Length Label (centered) */}
                        <text
                            transform={`translate(${(path.start.x + path.end.x) / 2}, ${(path.start.y + path.end.y) / 2}) scale(1, -1)`}
                            fill={labelColor}
                            fontSize="12"
                            fontWeight="bold"
                            textAnchor="middle"
                            dy="5"
                            style={{ textShadow: '0px 1px 2px black' }}
                        >
                            {labelText} {isOverlapping ? '⚠️' : ''}
                        </text>
                    </g>
                );
            })}

            {/* 2. CANDIDATE PATHS (Dashed, Interactive) */}
            {candidates.map((path, idx) => {
                const isHovered = hoverPathType === path.type;
                const opacity = isHovered ? 1.0 : 0.4;
                const width = isHovered ? 4 : 2;

                const points = sampleDubinsPath(path, 5);
                const d = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

                return (
                    <g
                        key={`candidate-${path.type}-${idx}`}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onPathClick?.(path);
                        }}
                        onMouseEnter={() => onPathHover?.(path.type)}
                        onMouseLeave={() => onPathHover?.(null)}
                    >
                        {/* Invisible thick hit area */}
                        <path d={d} stroke="transparent" strokeWidth="20" fill="none" />

                        {/* Visible Dashed Line */}
                        <path
                            d={d}
                            fill="none"
                            stroke={PathColors[path.type] || '#888'}
                            strokeWidth={width}
                            strokeOpacity={opacity}
                            strokeDasharray="8, 4"
                        />
                        {/* Type Label */}
                        {isHovered && (
                            <text
                                transform={`translate(${(path.start.x + path.end.x) / 2}, ${(path.start.y + path.end.y) / 2}) scale(1, -1)`}
                                fill="white"
                                fontSize="14"
                                fontWeight="bold"
                                textAnchor="middle"
                                dy="-10"
                                style={{ pointerEvents: 'none', textShadow: '0px 0px 4px black' }}
                            >
                                {path.type} ({(path.length / 50).toFixed(1)})
                            </text>
                        )}
                    </g>
                );
            })}

            {/* Legacy Rendering (fallback) */}
            {paths.map((path, idx) => {
                if (visibleTypes && !visibleTypes.has(path.type)) return null;
                const points = sampleDubinsPath(path, 5);
                const d = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
                return (
                    <g key={`legacy-${path.type}-${idx}`}>
                        <path
                            d={d}
                            fill="none"
                            stroke={overrideColor || PathColors[path.type]}
                            strokeWidth={width || 3}
                            strokeOpacity={0.8}
                        />
                    </g>
                );
            })}
        </g>
    );
}

function ConfigArrow({ config, color, label }: { config: Config, color: string, label: string }) {
    const len = 40;
    const x2 = config.x + len * Math.cos(config.theta);
    const y2 = config.y + len * Math.sin(config.theta); // Cartesian Y-Up in Standard Math? 
    // Wait, CSCanvas is Y-Down (SVG). 
    // Dubins solver assumes standard math (CCW positive).
    // If I pass SVG coordinates (y down) directly to Dubins solver:
    // start.y is 100, end.y is 200. dy = 100.
    // atan2(100, x) is positive angle (downwards).
    // if theta is 0 (right).
    // The visual result should be consistent IF we just render what solver outputs.
    // SVG standard: Y down. Theta increases CW or CCW?
    // SVG rotation is usually CW if Y is Down (positive Y).
    // But Math.cos/sin are standard.
    // So cos(theta) is X, sin(theta) is Y.
    // If Y is down, increasing theta moves vector down (positive Y).
    // So it acts as CW rotation visually.
    // Standard Dubins assumes "Left" turn means increasing theta? No, "Left" is CCW.
    // In SVG Y-Down:
    // Right is +X. Down is +Y.
    // Angle 0: Right.
    // Angle 90 (PI/2): Down.
    // Moving "Left" relative to forward vector:
    // If current heading is 0 (Right), "Left" should be Up (Negative Y).
    // Angle -90.
    // So Left turn DECREASES theta in SVG/Screen coords?
    // Dubins Logic: LSL -> Left turn.
    // If my Dubins logic uses standard math where Left is +deltaTheta, 
    // then in SVG, that +deltaTheta will look like a Right turn (CW).
    //
    // FIX: I should probably invert Y when communicating with Dubins Solver OR invert angles.
    // Easier approach: Use a coordinate transform group in CSCanvas `scale(1, -1)` like for Knots.
    // THen I can use standard Cartesian logic everywhere.
    //
    // Let's assume DubinsRenderer is rendered inside the SAME transform group as Knots?
    // Or I wrap it myself.
    // The Arrow should verify this.

    return (
        <g transform={`translate(${config.x}, ${config.y}) rotate(${config.theta * 180 / Math.PI})`}>
            {/* Arrow body */}
            <line x1="0" y1="0" x2={len} y2="0" stroke={color} strokeWidth="4" markerEnd={`url(#arrow-${color})`} />
            <circle r="6" fill={color} />

            {/* Visual Handle at Tip for Rotation */}
            <circle cx={len} cy={0} r="6" fill="white" stroke={color} strokeWidth="2" style={{ cursor: 'crosshair' }} />

            {/* Extended Hit Area */}
            <circle r="30" fill="transparent" stroke={color} strokeWidth="1" strokeDasharray="2 2" opacity="0.0" pointerEvents="none" />
        </g>
    );
}
