import React, { useMemo } from 'react';
import { type DubinsPath, type Config, sampleDubinsPath } from '@/core/geometry/dubins';

interface DubinsRendererProps {
    paths: DubinsPath[];
    startConfig: Config | null;
    endConfig: Config | null;
    visibleTypes: Set<string>;
}

const PathColors: Record<string, string> = {
    'LSL': '#FF6B6B',
    'RSR': '#4ECDC4',
    'LSR': '#45B7D1',
    'RSL': '#FFA07A',
    'RLR': '#96CEB4',
    'LRL': '#FFEEAD'
};

export function DubinsRenderer({ paths, startConfig, endConfig, visibleTypes }: DubinsRendererProps) {
    if ((!startConfig && !endConfig) && paths.length === 0) return null; // Allow render if we have paths but no global start/end

    return (
        <g className="dubins-renderer">
            {/* Render Paths */}
            {paths.map((path, idx) => {
                if (!visibleTypes.has(path.type)) return null;

                // Sample points
                const points = sampleDubinsPath(path, 5); // step 5px for smoothness
                const d = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

                return (
                    <g key={`${path.type}-${idx}`}>
                        <path
                            d={d}
                            fill="none"
                            stroke={PathColors[path.type] || '#333'}
                            strokeWidth="3"
                            strokeOpacity={0.8}
                        />
                        {/* Label somewhere? Maybe too cluttered. */}
                    </g>
                );
            })}

            {/* Render Configurations (Arrows) */}
            {startConfig && <ConfigArrow config={startConfig} color="blue" label="Start" />}
            {endConfig && <ConfigArrow config={endConfig} color="red" label="End" />}
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
