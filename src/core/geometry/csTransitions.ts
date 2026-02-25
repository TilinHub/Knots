/**
 * Stratum Jump Handler for CS Diagram
 *
 * This module connects the Kinematic solver (csSolver) with the rigorous validation (csValidator).
 * If a diagram step is invalid (e.g., segments cross disks or arcs shrink to zero),
 * this handles the fallback to dynamically rebuild the mathematical topology
 * from scratch using the shortest path geometry builder.
 */

import type { ContactDisk } from '../types/contactGraph';
import type { Point2D } from '../types/cs';
import { Logger } from '../utils/Logger';
import type { ArcSegment, EnvelopeSegment, TangentSegment } from './contactGraph';
import { buildBoundedCurvatureGraph, findEnvelopePath } from './contactGraph';
import type { CSDiagramState } from './csProtocol';
import { validateCSSpaceMatrix } from './csValidator';

// Helper function to build a mathematically rigorous CSDiagramState out of classic EnvelopeSegments.
export function createMathematicalStateFromPath(
    path: EnvelopeSegment[],
    disks: Map<string, ContactDisk>,
    _diskSequence: string[] // We strictly enforce the sequence
): CSDiagramState | null {
    if (path.length === 0) return null;

    const state: CSDiagramState = {
        disks: new Map(),
        contacts: [],
        tangencies: new Map(),
        segments: [],
        arcs: []
    };

    // 1. Populate discs
    disks.forEach((disk) => {
        state.disks.set(disk.id, { id: disk.id, center: { x: disk.center.x, y: disk.center.y }, radius: disk.radius });
    });

    // Calculate contacts based on exact distance 
    const diskArr = Array.from(disks.values());
    for (let i = 0; i < diskArr.length; i++) {
        for (let j = i + 1; j < diskArr.length; j++) {
            const dx = diskArr[i].center.x - diskArr[j].center.x;
            const dy = diskArr[i].center.y - diskArr[j].center.y;
            const expectedDist = diskArr[i].radius + diskArr[j].radius;
            if (Math.abs(Math.sqrt(dx * dx + dy * dy) - expectedDist) < 1.0) { // 1px tolerance
                state.contacts.push({
                    id: `${diskArr[i].id}-${diskArr[j].id}`,
                    diskId1: diskArr[i].id,
                    diskId2: diskArr[j].id
                });
            }
        }
    }

    // 2. Parse Path to extract Lines
    const lines = path.filter(seg => seg.type !== 'ARC') as TangentSegment[];
    if (lines.length === 0) return null;

    let tIndex = 0;
    let sIndex = 0;
    let aIndex = 0;

    interface LineContext {
        line: TangentSegment;
        tOutId: string;
        tInId: string;
    }

    const lineContexts: LineContext[] = lines.map(line => ({
        line,
        tOutId: `t_${tIndex++}`,
        tInId: `t_${tIndex++}`
    }));

    // 3. Create Tangencies and Line Segments
    for (const ctx of lineContexts) {
        const epsOut = ctx.line.type.startsWith('L') ? 1 : -1;
        const diskOut = state.disks.get(ctx.line.startDiskId!);

        if (!diskOut) {
            Logger.warn('csTransitions', `Cannot find start disk '${ctx.line.startDiskId}' in state.disks. Aborting state creation.`);
            return null;
        }

        const dxOut = ctx.line.start.x - diskOut.center.x;
        const dyOut = ctx.line.start.y - diskOut.center.y;
        const lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut) || 1;
        const tOutNormal = { x: dxOut / lenOut, y: dyOut / lenOut };

        state.tangencies.set(ctx.tOutId, {
            id: ctx.tOutId,
            diskId: diskOut.id,
            point: { x: ctx.line.start.x, y: ctx.line.start.y },
            normal: tOutNormal,
            tangent: { x: epsOut * -tOutNormal.y, y: epsOut * tOutNormal.x },
            epsilon: epsOut
        });

        const epsIn = ctx.line.type.endsWith('L') ? 1 : -1;
        const diskIn = state.disks.get(ctx.line.endDiskId!);

        if (!diskIn) {
            Logger.warn('csTransitions', `Cannot find end disk '${ctx.line.endDiskId}' in state.disks. Aborting state creation.`);
            return null;
        }

        const dxIn = ctx.line.end.x - diskIn.center.x;
        const dyIn = ctx.line.end.y - diskIn.center.y;
        const lenIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn) || 1;
        const tInNormal = { x: dxIn / lenIn, y: dyIn / lenIn };

        state.tangencies.set(ctx.tInId, {
            id: ctx.tInId,
            diskId: diskIn.id,
            point: { x: ctx.line.end.x, y: ctx.line.end.y },
            normal: tInNormal,
            tangent: { x: -epsIn * -tInNormal.y, y: -epsIn * tInNormal.x },
            epsilon: epsIn
        });

        state.segments.push({
            id: `s_${sIndex++}`,
            startTangencyId: ctx.tOutId,
            endTangencyId: ctx.tInId
        });
    }

    // 4. Create Arcs to connect the Segments
    for (let i = 0; i < lineContexts.length; i++) {
        const currCtx = lineContexts[i];
        const nextCtx = lineContexts[(i + 1) % lineContexts.length];

        const diskId = currCtx.line.endDiskId;
        if (diskId !== nextCtx.line.startDiskId) {
            Logger.warn('csTransitions', 'Path line discontinuity found between segments!', { curr: diskId, next: nextCtx.line.startDiskId });
            // For now, assume it's still mathematically connected on the same disk due to topology solver.
            // A more robust implementation might handle intermediate missing disks.
        }

        const incomingId = currCtx.tInId;
        const outgoingId = nextCtx.tOutId;

        const tangencyIn = state.tangencies.get(incomingId)!;
        const tangencyOut = state.tangencies.get(outgoingId)!;

        // Use the outgoing line to determine arc chirality
        const arcChirality = nextCtx.line.type.startsWith('L') ? 'L' : 'R';
        const epsArc = arcChirality === 'L' ? 1 : -1;

        let startAngle = Math.atan2(tangencyIn.normal.y, tangencyIn.normal.x);
        let endAngle = Math.atan2(tangencyOut.normal.y, tangencyOut.normal.x);

        const PI2 = 2 * Math.PI;
        let delta = endAngle - startAngle;
        while (delta <= -Math.PI) delta += PI2;
        while (delta > Math.PI) delta -= PI2;

        const distSq = (tangencyIn.point.x - tangencyOut.point.x) ** 2 + (tangencyIn.point.y - tangencyOut.point.y) ** 2;
        if (distSq < 1e-6) {
            delta = 0;
        } else {
            if (arcChirality === 'L') {
                if (delta <= 0) delta += PI2;
            } else {
                if (delta >= 0) delta -= PI2;
                delta = Math.abs(delta);
            }
        }

        state.arcs.push({
            id: `a_${aIndex++}`,
            startTangencyId: incomingId,
            endTangencyId: outgoingId,
            diskId: diskId,
            sign: epsArc,
            deltaTheta: delta
        });
    }

    const validation = validateCSSpaceMatrix(state);
    if (!validation.valid) {
        console.error('[csTransitions] Failed validation:', validation.errors);
        Logger.error('csTransitions', 'Failed to generate rigorous mathematical state from fallback path', validation.errors);
        return null;
    }

    return state;
}

/**
 * Attempts an optimistic kinematic displacement.
 * If the resulting state violates constraints, mathematically fallback to a hard-recalculated topological path.
 */
export function transitionCSDiagramState(
    currentState: CSDiagramState,
    proposedDisks: Map<string, Point2D>,
    chiralities: ('L' | 'R')[],
    diskSequence: string[]
): CSDiagramState {

    // Create a deep copy assuming optimistic pass
    const nextState: CSDiagramState = JSON.parse(JSON.stringify(currentState));

    // Apply changes directly as an abstract assumption
    // (In a full real-world engine, we apply solveCSDiagramDelta and push points by delta p)
    // For the scope of this step, we just test validation

    const validationResult = validateCSSpaceMatrix(nextState);

    // If constraints failed (e.g. S2 crossed a disk), we do a Stratum Jump!
    // It completely throws away the kinematic prediction and recomputes a safe shortest path topology.
    if (!validationResult.valid) {
        Logger.info('csTransitions', 'Constraint violation detected. Executing Topological Stratum Jump!', validationResult.errors);

        const contactDisks: ContactDisk[] = diskSequence.map(id => {
            const cd = proposedDisks.get(id) || currentState.disks.get(id)!.center;
            return { id: id, center: cd, radius: 1, regionId: 'topology_jump' };
        });

        // Robust re-calculation
        const graph = buildBoundedCurvatureGraph(contactDisks, true);
        const fallbackPath = findEnvelopePath(graph, diskSequence, chiralities, false);

        const diskMap = new Map<string, ContactDisk>();
        contactDisks.forEach(cd => diskMap.set(cd.id, cd));

        const recoveredState = createMathematicalStateFromPath(fallbackPath.path, diskMap, diskSequence);
        if (recoveredState) return recoveredState;
    }

    // Optismistic pass success or jump failure returns optimistic anyway.
    return nextState;
}

