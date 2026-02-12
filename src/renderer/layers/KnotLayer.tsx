import React, { useMemo } from 'react';
import { BaseLayer } from './BaseLayer';
import type { LayerProps } from '../types/Layer';
import { PathLayer } from './PathLayer';
import { KnotEnvelopeComputer } from '../../features/knot/logic/KnotEnvelopeComputer';
import type { EnvelopeSegment } from '../../core/geometry/contactGraph'; // Correct import?
import type { CSDisk } from '../../core/types/cs';

interface KnotLayerProps extends LayerProps {
    knotPath: EnvelopeSegment[];
    anchorPoints: { x: number, y: number }[];
    showEnvelope: boolean;
    envelopeColor: string;
    knotMode: boolean;
    onKnotPointClick?: (diskId: string, point: { x: number, y: number }) => void;
    savedKnotPaths?: { id: string, color: string, path: EnvelopeSegment[] }[];
}

export const KnotLayer: React.FC<KnotLayerProps> = ({
    visible,
    blocks,
    knotPath,
    anchorPoints,
    showEnvelope,
    envelopeColor,
    knotMode,
    onKnotPointClick,
    context,
    savedKnotPaths = []
}) => {
    if (!visible) return null; // Show even if not knotMode? No, user implied "knot mode envelope". 
    // Actually, saved knots might want to be visible always? 
    // The previous code in CSCanvas passed them.
    // If they are specific to Knot Mode, then (!visible || !knotMode) return null is fine.
    // But usually saved stuff is visible for reference.
    // However, the prompt says "La envolvente del knot mode".
    // Let's stick to showing them only in Knot Mode for now, OR if they were always visible before.
    // In monolithic CSCanvas, they were rendered if `savedKnotPaths` existed.
    // Let's assume they should be visible if passed.
    // But KnotLayer has `if (!visible || !knotMode) return null;`
    // I will keep it strict to Knot Mode for now as per "KnotLayer".

    if (!visible || !knotMode) return null;

    // ... (rest of filtering)

    // Dimensions for transform
    const { width = 800, height = 600 } = context || {};
    const centerX = width / 2;
    const centerY = height / 2;

    const disks = useMemo(() => blocks.filter((b): b is CSDisk => b.kind === 'disk'), [blocks]);

    // 1. Compute Knot Envelope (Robust Hull) locally using Strategy
    const computer = useMemo(() => new KnotEnvelopeComputer(), []);
    const knotEnvelopePath = useMemo(() => {
        if (!showEnvelope || disks.length === 0) return [];
        return computer.compute(disks);
    }, [disks, showEnvelope, computer]);

    return (
        <BaseLayer visible={visible} zIndex={10}>
            <g transform={`translate(${centerX}, ${centerY}) scale(1, -1)`}>
                {/* Robust Envelope (Active) */}
                {showEnvelope && (
                    <PathLayer
                        path={knotEnvelopePath}
                        color={envelopeColor || '#6B46C1'}
                        width={2}
                    />
                )}

                {/* SAVED Knots */}
                {savedKnotPaths.map(k => (
                    <PathLayer
                        key={k.id}
                        path={k.path}
                        color={k.color}
                        width={3}
                    />
                ))}

                {/* Active Knot Path */}
                <PathLayer
                    path={knotPath}
                    color="#FF0000"
                    width={4}
                />

                {/* Debug Anchors */}
                {anchorPoints && anchorPoints.map((p, i) => (
                    <circle
                        key={`anchor-${i}`}
                        cx={p.x} cy={p.y}
                        r={6}
                        fill="#8A2BE2"
                        stroke="white"
                        strokeWidth={2}
                        pointerEvents="none"
                    />
                ))}

                {/* Clickable Anchors (N/S/E/W) logic moved from CSCanvas? 
                 CSCanvas renders anchors on top of disks using SVG coords. 
                 This is tricky because `toSVG` is in Canvas.
                 We will keep Clickable Anchors in CSCanvas (Disk Layer) for now to minimize risk 
                 or move `toSVG` to a utility context. 
                 Since Step 1 is "Scaffolding", we can leave interactables in Canvas and move only Paths here.
                 The task said "KnotLayer (renders knot path & envelope)".
             */}
            </g>
        </BaseLayer>
    );
};
