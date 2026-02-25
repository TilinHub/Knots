/**
 * CS Converter Tool
 *
 * Converts a mathematically rigorous CSDiagramState back into the UI-compatible
 * EnvelopeSegment[] arrays used by CSCanvas for rendering.
 */

import type { CSDiagramState } from './csProtocol';
import type { EnvelopeSegment, ArcSegment, TangentSegment } from './contactGraph';
import type { Point2D } from '../types/cs';

export function convertStateToPath(state: CSDiagramState): EnvelopeSegment[] {
    const path: EnvelopeSegment[] = [];

    // Identify Tangencies by ID for fast lookup
    const tangencies = state.tangencies;

    // Process Arcs -> ArcSegments
    state.arcs.forEach((arc) => {
        const startT = tangencies.get(arc.startTangencyId);
        const endT = tangencies.get(arc.endTangencyId);
        const disk = state.disks.get(arc.diskId);

        if (!startT || !endT || !disk) return;

        const startAngle = Math.atan2(startT.normal.y, startT.normal.x);
        const endAngle = Math.atan2(endT.normal.y, endT.normal.x);

        path.push({
            type: 'ARC',
            diskId: arc.diskId,
            center: disk.center,
            radius: disk.radius, // Fix: Use real mathematical radius from state
            startAngle,
            endAngle,
            chirality: arc.sign === 1 ? 'L' : 'R',
            length: arc.deltaTheta * disk.radius, // length = delta * real radius
        } as ArcSegment);
    });

    // Process Segments -> TangentSegments
    // Note: For TangentSegments, the rendering system historically relies on the specific
    // type 'LSL', 'RSR', 'LSR', 'RSL'. We must infer it from the adjoining epsilon orientation.
    state.segments.forEach((seg) => {
        const startT = tangencies.get(seg.startTangencyId);
        const endT = tangencies.get(seg.endTangencyId);

        if (!startT || !endT) return;

        const startChirality = startT.epsilon === 1 ? 'L' : 'R';
        const endChirality = endT.epsilon === 1 ? 'L' : 'R';

        // Heuristically map tangency epsilons back to traditional bitangent labels
        let tangentType: 'LSL' | 'RSR' | 'LSR' | 'RSL' = 'LSL';
        if (startChirality === 'L' && endChirality === 'L') tangentType = 'LSL';
        if (startChirality === 'R' && endChirality === 'R') tangentType = 'RSR';
        if (startChirality === 'L' && endChirality === 'R') tangentType = 'LSR';
        if (startChirality === 'R' && endChirality === 'L') tangentType = 'RSL';

        const dx = endT.point.x - startT.point.x;
        const dy = endT.point.y - startT.point.y;

        path.push({
            type: tangentType,
            start: startT.point,
            end: endT.point,
            startDiskId: startT.diskId,
            endDiskId: endT.diskId,
            length: Math.sqrt(dx * dx + dy * dy),
        } as TangentSegment);
    });

    // Return unordered (the renderer usually expects ordering, so if issues appear we must sort).
    // Ideally, sort them according to logical sequential path tracing: Arc -> Segment -> Arc
    return orderSegments(path);
}

// Ensure the UI gets a continuous C1 chain instead of a random bucket
function orderSegments(segments: EnvelopeSegment[]): EnvelopeSegment[] {
    if (segments.length === 0) return [];

    const ordered: EnvelopeSegment[] = [];
    const remaining = new Set(segments);

    // Start with an ARC
    let curr: EnvelopeSegment | undefined = Array.from(remaining).find(s => s.type === 'ARC');
    if (!curr) return segments; // fallback

    ordered.push(curr);
    remaining.delete(curr);

    while (remaining.size > 0) {
        let next: EnvelopeSegment | undefined;
        if (curr.type === 'ARC') {
            // Look for a segment that starts where this arc ends (diskId match or proximity)
            const arc = curr as ArcSegment;
            next = Array.from(remaining).find(s => s.type !== 'ARC' && (s as unknown as TangentSegment).startDiskId === arc.diskId);
        } else {
            // Look for an arc that starts where this segment ends
            const tang = curr as unknown as TangentSegment;
            next = Array.from(remaining).find(s => s.type === 'ARC' && (s as ArcSegment).diskId === tang.endDiskId);
        }

        if (!next) {
            // Disconnected chain in abstract state, dump the rest
            Array.from(remaining).forEach(s => ordered.push(s));
            break;
        }

        ordered.push(next);
        remaining.delete(next);
        curr = next;
    }

    return ordered;
}
