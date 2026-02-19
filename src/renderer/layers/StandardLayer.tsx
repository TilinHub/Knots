import React, { useMemo } from 'react';

import { computeDiskHull, type DiskHull } from '../../core/geometry/diskHull';
import type { CSDisk } from '../../core/types/cs';
import { EditorEnvelopeComputer } from '../../features/editor/logic/EditorEnvelopeComputer';
import type { LayerProps } from '../types/Layer';
import { BaseLayer } from './BaseLayer';
import { PathLayer } from './PathLayer';

interface StandardLayerProps extends LayerProps {
    showEnvelope: boolean;
    envelopeColor: string;
    knotMode: boolean;
}

// Transform helper (duplicated for now, or moved to utils)
function toSVG(x: number, y: number, centerX: number, centerY: number): [number, number] {
    return [centerX + x, centerY - y];
}

function transformPathToSVG(d: string, centerX: number, centerY: number): string {
    return d.replace(/([ML])\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g, (_, cmd, x, y) => {
        const [sx, sy] = toSVG(parseFloat(x), parseFloat(y), centerX, centerY);
        return `${cmd} ${sx} ${sy}`;
    }).replace(/A\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g,
        (_, rx, ry, rot, large, sweep, ex, ey) => {
            const [sx, sy] = toSVG(parseFloat(ex), parseFloat(ey), centerX, centerY);
            const newSweep = sweep === '0' ? '1' : '0';
            return `A ${rx} ${ry} ${rot} ${large} ${newSweep} ${sx} ${sy}`;
        });
}

export const StandardLayer: React.FC<StandardLayerProps> = ({
    visible,
    blocks, // CSBlocks
    showEnvelope,
    envelopeColor,
    knotMode,
    context // Expecting { width, height } for center calculation?
}) => {
    // If we are in Knot Mode, Standard Layer (Envelope) is usually hidden?
    // CSCanvas logic: !knotMode && showEnvelope
    if (!visible || !showEnvelope || knotMode) return null;

    const disks = useMemo(() => blocks.filter((b): b is CSDisk => b.kind === 'disk'), [blocks]);

    // 1. Compute Standard Envelope (Outer Contour)
    const computer = useMemo(() => new EditorEnvelopeComputer(), []);
    const outerContourPath = useMemo(() => {
        return computer.compute(disks);
    }, [disks, computer]);

    // 2. Compute Hull for Fill (Legacy Blue Blur)
    // We duplicate this logic from CSCanvas for now to make Layer self-contained
    const hullData = useMemo(() => {
        if (disks.length < 3) return null;
        const simpleDisks = disks.map(d => ({ x: d.center.x, y: d.center.y, r: d.visualRadius, id: d.id }));
        return computeDiskHull(simpleDisks);
    }, [disks]);

    const { width = 800, height = 600 } = context || {};
    const centerX = width / 2;
    const centerY = height / 2;

    return (
        <BaseLayer visible={visible} zIndex={1}>
            {/* 1. Red Line (Original "Chain Exposed Arcs") */}
            {outerContourPath.length > 0 && (
                <g transform={`translate(${centerX}, ${centerY}) scale(1, -1)`}>
                    <PathLayer
                        path={outerContourPath}
                        color={envelopeColor || '#6B46C1'}
                        width={2}
                    />
                </g>
            )}

            {/* 2. Blue Fill (Legacy Hull) - Needs explicit SVG path transform because it uses 'd' string logic */}
            {hullData && (
                <path
                    d={transformPathToSVG(hullData.svgPathD, centerX, centerY)}
                    fill={envelopeColor}
                    fillOpacity={0.1}
                    stroke="none"
                    style={{ pointerEvents: 'none' }}
                />
            )}
        </BaseLayer>
    );
};
