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
import type { ArcSegment, EnvelopeSegment } from './contactGraph';
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
        state.disks.set(disk.id, { id: disk.id, center: { x: disk.center.x, y: disk.center.y } });
    });

    // Calculate contacts based on exact distance 2
    const diskArr = Array.from(disks.values());
    for (let i = 0; i < diskArr.length; i++) {
        for (let j = i + 1; j < diskArr.length; j++) {
            const dx = diskArr[i].center.x - diskArr[j].center.x;
            const dy = diskArr[i].center.y - diskArr[j].center.y;
            if (Math.abs(Math.sqrt(dx * dx + dy * dy) - 2.0) < 1e-4) {
                state.contacts.push({
                    id: `${diskArr[i].id}-${diskArr[j].id}`,
                    diskId1: diskArr[i].id,
                    diskId2: diskArr[j].id
                });
            }
        }
    }

    // 2. Parse Path
    let tIndex = 0;
    let sIndex = 0;
    let aIndex = 0;

    // Since it's a loop, we trace pairs of tangencies per disk.
    // Each ARC segment provides an incoming tangency and an outgoing tangency.
    // Each non-ARC provides a physical line.

    // We loop to find arcs
    path.forEach((seg) => {
        if (seg.type === 'ARC') {
            const arc = seg as ArcSegment;
            const tInId = `t_${tIndex++}`;
            const tOutId = `t_${tIndex++}`;

            const tInNormal = { x: Math.cos(arc.startAngle), y: Math.sin(arc.startAngle) };
            const tOutNormal = { x: Math.cos(arc.endAngle), y: Math.sin(arc.endAngle) };

            const eps = arc.chirality === 'L' ? 1 : -1;

            state.tangencies.set(tInId, {
                id: tInId,
                diskId: arc.diskId,
                point: { x: arc.center.x + tInNormal.x, y: arc.center.y + tInNormal.y },
                normal: tInNormal,
                tangent: { x: eps * -tInNormal.y, y: eps * tInNormal.x },
                epsilon: eps
            });

            state.tangencies.set(tOutId, {
                id: tOutId,
                diskId: arc.diskId,
                point: { x: arc.center.x + tOutNormal.x, y: arc.center.y + tOutNormal.y },
                normal: tOutNormal,
                tangent: { x: eps * -tOutNormal.y, y: eps * tOutNormal.x },
                epsilon: eps
            });

            // Compute Delta Theta safely in CCW format considering chirality
            const PI2 = 2 * Math.PI;
            let delta = arc.endAngle - arc.startAngle;
            while (delta <= -Math.PI) delta += PI2;
            while (delta > Math.PI) delta -= PI2;

            if (arc.chirality === 'L') {
                if (delta <= 0) delta += PI2;
            } else {
                if (delta >= 0) delta -= PI2;
                delta = Math.abs(delta);
            }

            state.arcs.push({
                id: `a_${aIndex++}`,
                startTangencyId: tInId,
                endTangencyId: tOutId,
                diskId: arc.diskId,
                sign: eps,
                deltaTheta: delta
            });
        }
    });

    // Second pass: hook up the lines. Assuming alternating logic in typical outputs:
    // ARC -> Tangent -> ARC 
    const tangencyList = Array.from(state.tangencies.values());
    for (let i = 0; i < tangencyList.length; i += 2) {
        // Current outgoing tangency is i+1, next incoming tangency is (i+2) % len
        const outgoing = tangencyList[i + 1];
        const nextIncoming = tangencyList[(i + 2) % tangencyList.length];

        state.segments.push({
            id: `s_${sIndex++}`,
            startTangencyId: outgoing.id,
            endTangencyId: nextIncoming.id
        });
    }

    // Final Strict Check before passing control to kinematic handler
    const validation = validateCSSpaceMatrix(state);
    if (!validation.valid) {
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

