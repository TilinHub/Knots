import type {
    BoundedCurvatureGraph,
    TangentSegment
} from '../geometry/contactGraph';
import type { ContactDisk } from '../types/contactGraph'; // Correct import
import type { DubinsPath } from '../geometry/dubins';

/**
 * Interface for a multi-hop Dubins path (sequence of segments)
 */
export type CompoundPath = DubinsPath[];

/**
 * Helper to determine Chirality from Tangent Type
 */
function getStartChirality(type: string): 'L' | 'R' {
    return type[0] as 'L' | 'R';
}

function getEndChirality(type: string): 'L' | 'R' {
    return type[2] as 'L' | 'R';
}

/**
 * Calculates arc length on a disk between two angles, given a direction.
 */
function calcArcLength(radius: number, angleIn: number, angleOut: number, chirality: 'L' | 'R'): number {
    const PI2 = 2 * Math.PI;
    let delta = angleOut - angleIn;

    if (chirality === 'L') { // CCW
        while (delta < 0) delta += PI2;
    } else { // CW
        while (delta > 0) delta -= PI2;
        delta = Math.abs(delta);
    }
    return delta * radius;
}

/**
 * Finds the shortest path through the contact graph using Dijkstra.
 * Enforces Chirality Continuity (L->L, R->R).
 */
export function findShortestContactPath(
    startDiskId: string,
    endDiskId: string,
    graph: BoundedCurvatureGraph
): CompoundPath[] {

    // 1. Identify Edges
    // We treat each Edge in the graph as a Node in Dijkstra.
    // Plus a virtual "Start" node.
    // Edge structure: TangentSegment.

    // Filter edges relevant to this problem (optional optimization)
    // Actually we need global search.

    const allEdges = graph.edges;

    // State: [EdgeIndex] -> MinCost
    const dist = new Map<number, number>();
    const parent = new Map<number, number>(); // EdgeIndex -> Previous EdgeIndex
    const visited = new Set<number>();

    // Priority Queue (naive array for simplicity with small N)
    // Item: { edgeIndex: number, cost: number }
    const pq: { index: number, cost: number }[] = [];

    // Initialize with all edges starting at startDiskId
    for (let i = 0; i < allEdges.length; i++) {
        const e = allEdges[i];
        if (e.startDiskId === startDiskId) {
            // Initial cost is just the edge length (Arc on start disk is 0 or implied free)
            dist.set(i, e.length);
            parent.set(i, -1); // Root
            pq.push({ index: i, cost: e.length });
        }
    }

    let bestEndIndex = -1;
    let minTotalCost = Infinity;

    while (pq.length > 0) {
        // Pop min
        pq.sort((a, b) => a.cost - b.cost);
        const current = pq.shift()!;

        if (current.cost > (dist.get(current.index) ?? Infinity)) continue;
        if (visited.has(current.index)) continue;
        visited.add(current.index);

        const currEdge = allEdges[current.index];

        // Check if destination
        if (currEdge.endDiskId === endDiskId) {
            if (current.cost < minTotalCost) {
                minTotalCost = current.cost;
                bestEndIndex = current.index;
            }
            // We don't stop strictly because there might be other paths, 
            // but finding ONE shortest is usually enough. 
            // Continue optimization? 
            // Dijkstra guarantees first pop of specific node is optimal.
            // But we have multiple "End Nodes" (any edge ending at Target).
            // We can just track best.
            continue;
        }

        // Expand
        // Find edges starting at currEdge.endDiskId
        // AND matching chirality
        const arrChirality = getEndChirality(currEdge.type);
        const pivotDiskId = currEdge.endDiskId;
        const pivotDisk = graph.nodes.get(pivotDiskId);

        if (!pivotDisk) continue;

        for (let nextIdx = 0; nextIdx < allEdges.length; nextIdx++) {
            const nextEdge = allEdges[nextIdx];

            // Must start at pivot
            if (nextEdge.startDiskId !== pivotDiskId) continue;

            // Check Chirality Continuity
            const depChirality = getStartChirality(nextEdge.type);
            if (depChirality !== arrChirality) continue;

            // Calculate Arc Cost
            const angleIn = Math.atan2(
                currEdge.end.y - pivotDisk.center.y,
                currEdge.end.x - pivotDisk.center.x
            );
            const angleOut = Math.atan2(
                nextEdge.start.y - pivotDisk.center.y,
                nextEdge.start.x - pivotDisk.center.x
            );

            const arcLen = calcArcLength(pivotDisk.radius, angleIn, angleOut, arrChirality);

            const newCost = current.cost + arcLen + nextEdge.length;

            if (newCost < (dist.get(nextIdx) ?? Infinity)) {
                dist.set(nextIdx, newCost);
                parent.set(nextIdx, current.index);
                pq.push({ index: nextIdx, cost: newCost });
            }
        }
    }

    if (bestEndIndex === -1) return []; // No path

    // Reconstruct
    const edgeSequence: TangentSegment[] = [];
    let curr = bestEndIndex;
    while (curr !== -1) {
        edgeSequence.unshift(allEdges[curr]);
        curr = parent.get(curr)!;
    }

    // Convert Sequence to DubinsPath objects
    // A sequence of edges [E1, E2, E3] connected by arcs.
    // We want to format this as a list of segments compatible with renderer.
    // DubinsPath structure: { start, end, type: LSL/LSR..., param1, param2, param3 }
    // 
    // We can represent each Hop as a DubinsPath.
    // E1 is a Straight Line.
    // Arc between E1 and E2.
    // E2 is a Straight Line.
    //
    // Wait. If we bundle Arc(E1->E2) into Path1.
    // Path1 End Point becomes Start of E2.
    // Correct.
    // The "DubinsPath" object connects "Start Config" to "End Config".
    // 
    // Path 1:
    // Start: E1.start
    // End: E2.start (After the arc)
    // Structure: Line(E1) + Arc(E1->E2).
    // Standard Dubins param order: Arc1, Line, Arc2.
    // This is Line, Arc. (0, Line, Arc).
    // Is (0, Line, Arc) supported?
    // Bitangent Types: LSL means Left-Straight-Left.
    // Param1=L, Param2=S, Param3=L.
    // If we set Param1=0.
    // Then it generates Straight, then Left Arc.
    // Yes!
    // So Path 1 (LSL) with p1=0 -> Straight, Left Arc.
    // This covers E1 and the Arc to E2.
    //
    // Last Edge (En):
    // Start: En.start
    // End: En.end
    // Structure: Line(En) + Arc=0.
    //
    // So we can cover the full chain.
    //
    // One nuance: Chirality.
    // E1 type (e.g. LSL).
    // E1 is S. Arc1 is L (from LSL).
    // If Transition is L->L.
    // Path 1 should be LSL (0, len, arc).
    //
    // What if E1 is RSR?
    // Path 1 should be RSR (0, len, arc).
    //
    // What if E1 is LSR (L->R)?
    // E1 Start L, End R.
    // Arc at End is R-type (CW).
    // Transition R->R.
    // So we use 'RSR' template?
    // No, E1 type is LSR.
    // LSR params: Arc1, Line, Arc2.
    // Arc1=0. Line=E1. Arc2=TransitionArc.
    // Since Arc2 is 'R' (from LSR name), and Transition is R. Matches!
    //
    // So: Use Edge.Type as the DubinsPath Type.
    // Set Param1 = 0.
    // Set Param2 = Edge.Length.
    // Set Param3 = Transition Arc Length.
    //
    // Exception: Last Edge.
    // Param3 = 0.

    // Construct Nodes
    const paths: DubinsPath[] = [];
    const groupId = `compound-${Date.now()}-${Math.random()}`;

    for (let i = 0; i < edgeSequence.length; i++) {
        const edge = edgeSequence[i];
        let arcLen = 0;
        let nextStart: { x: number, y: number, theta: number } | null = null;

        if (i < edgeSequence.length - 1) {
            const nextEdge = edgeSequence[i + 1];
            // Calculate arc
            const pivotDisk = graph.nodes.get(edge.endDiskId)!;
            const arrChirality = getEndChirality(edge.type);

            const angleIn = Math.atan2(
                edge.end.y - pivotDisk.center.y,
                edge.end.x - pivotDisk.center.x
            );
            const angleOut = Math.atan2(
                nextEdge.start.y - pivotDisk.center.y,
                nextEdge.start.x - pivotDisk.center.x
            );
            arcLen = calcArcLength(pivotDisk.radius, angleIn, angleOut, arrChirality);

            // Tangent at next start
            // If chirality is L (CCW), tangent = angle + PI/2
            // If R (CW), tangent = angle - PI/2
            const nextChirality = getStartChirality(nextEdge.type);
            const nextTheta = angleOut + (nextChirality === 'L' ? Math.PI / 2 : -Math.PI / 2);

            nextStart = {
                x: nextEdge.start.x,
                y: nextEdge.start.y,
                theta: nextTheta
            };
        } else {
            // Last segment
            // End config is Edge End
            // Tangent?
            // EndChirality determines tangent relative to radial
        }

        // Start Config of this segment
        // If i=0, it's edge.start with proper tangent
        // If i>0, it matches prev End Config

        // Let's compute exact Start/End configs for the Path object
        const startDisk = graph.nodes.get(edge.startDiskId)!;
        const endDisk = graph.nodes.get(edge.endDiskId)!;

        const startChirality = getStartChirality(edge.type);
        const endChirality = getEndChirality(edge.type);

        const angleS = Math.atan2(edge.start.y - startDisk.center.y, edge.start.x - startDisk.center.x);
        const thetaS = angleS + (startChirality === 'L' ? Math.PI / 2 : -Math.PI / 2);

        // For Path End Config:
        // If not last, it includes the Arc... so it ends at NextEdge.Start
        // If last, it ends at Edge.End

        let pathEndCfg;
        if (nextStart) {
            pathEndCfg = nextStart;
        } else {
            const angleE = Math.atan2(edge.end.y - endDisk.center.y, edge.end.x - endDisk.center.x);
            const thetaE = angleE + (endChirality === 'L' ? Math.PI / 2 : -Math.PI / 2);
            pathEndCfg = { x: edge.end.x, y: edge.end.y, theta: thetaE };
        }

        const pathStartCfg = { x: edge.start.x, y: edge.start.y, theta: thetaS };

        // Rho?
        // Edge connects Disk1 to Disk2.
        // LSL: Rho1=D1, Rho2=D2.
        // DubinsPath object has single 'rho' or rhoStart/rhoEnd.
        // We should populate rhoStart/rhoEnd.

        paths.push({
            type: edge.type as any,
            length: edge.length + arcLen, // Param2 + Param3
            param1: 0,
            param2: edge.length,
            param3: arcLen,
            rho: startDisk.radius, // Fallback
            rhoStart: startDisk.radius,
            rhoEnd: endDisk.radius,
            start: pathStartCfg,
            end: pathEndCfg,
            groupId: groupId,
            startDiskId: edge.startDiskId,
            endDiskId: edge.endDiskId
        });
    }

    // Return as array of alternatives (just 1 alternative which is the whole chain)
    return [paths];
}
