
import type { DubinsPath } from '../../../core/geometry/dubins';
import type { CSDisk } from '../../../core/types/cs';

/**
 * State of the Elastic Band on a single disk.
 * Stores continuous angles (unwrapped) to maintain winding numbers (topology).
 */
interface DiskContactState {
    thetaIn: number;  // Angle of arrival
    thetaOut: number; // Angle of departure
}

export class ElasticBandSolver {
    // Persist state across frames to ensure continuity and topology preservation
    private state = new Map<string, DiskContactState>();

    /**
     * Solves for the elastic envelope path using iterative relaxation.
     */
    public calculateElasticPath(
        disks: CSDisk[],
        sequence: string[],
        chiralities: ('L' | 'R')[],
        closed: boolean = true
    ): DubinsPath[] {
        if (sequence.length < 2) return [];

        const diskMap = new Map<string, CSDisk>();
        disks.forEach(d => diskMap.set(d.id, d));

        // 1. Initialize State (Seeding)
        this.initializeState(sequence, disks, chiralities);

        // 2. Iterative Relaxation (Coordinate Descent)
        // Passes to converge to the bi-tangent configuration
        const iterations = 10;
        for (let iter = 0; iter < iterations; iter++) {
            for (let i = 0; i < sequence.length; i++) {
                const isLast = i === sequence.length - 1;
                if (!closed && isLast) continue; // Open chain last point doesn't need optimization if handled differently?

                // Identify Neighbors
                const diskId = sequence[i];
                const prevId = sequence[(i - 1 + sequence.length) % sequence.length];
                const nextId = sequence[(i + 1) % sequence.length];

                // For open chains, endpoints are special. 
                // But Envelope is usually closed loop? The method signature says default true.
                if (!closed && i === 0) continue; // Start fixed?

                this.relaxDisk(diskId, prevId, nextId, diskMap, chiralities[i] || 'L');
            }
        }

        // 3. Generate Geometric Path
        const paths: DubinsPath[] = [];

        for (let i = 0; i < sequence.length; i++) {
            if (!closed && i === sequence.length - 1) break;

            const id1 = sequence[i];
            const id2 = sequence[(i + 1) % sequence.length];
            const disk1 = diskMap.get(id1);
            const disk2 = diskMap.get(id2);

            if (!disk1 || !disk2) continue;

            // Retrieve optimized angles
            const state1 = this.state.get(id1)!;
            const state2 = this.state.get(id2)!;

            // 3a. Contact Point 1 (Departure)
            const p1 = {
                x: disk1.center.x + disk1.visualRadius * Math.cos(state1.thetaOut),
                y: disk1.center.y + disk1.visualRadius * Math.sin(state1.thetaOut),
                theta: state1.thetaOut // Heading? Tangent heading depends on Chirality
            };

            // 3b. Contact Point 2 (Arrival)
            const p2 = {
                x: disk2.center.x + disk2.visualRadius * Math.cos(state2.thetaIn),
                y: disk2.center.y + disk2.visualRadius * Math.sin(state2.thetaIn),
                theta: state2.thetaIn
            };

            // 3c. Dubins Arc on Disk 1 (Connecting In to Out)
            // We need to add the Arc segment for Disk 1 if we are building a continuous path.
            // But usually paths[] contains segments BETWEEN disks.
            // And we assume the renderer handles the vertex joining?
            // Existing `EnvelopePathCalculator` returned [Tangent, Arc, Tangent, Arc] logic?
            // No, it returned `DubinsPath` which is usually CSC or Linear.
            // Let's look at `EnvelopePathCalculator.ts`:
            // It pushes `currentPath` (Connection) then pushes `Arc` (on disk2).
            // So we should generate the Connection (Line) and the Arc (on disk1? or disk2?).
            // Standard: Segment i is Disk i -> Disk i+1.
            // This segment is a LINE.
            // Then we add an ARC on Disk i+1 to connect to the next line.

            // 1. Line Segment (Tangent)
            // Ideally this is just a straight line LSL, LSR etc type.
            // We can determine type from chiralities.
            const c1 = chiralities[i] || 'L';
            const c2 = chiralities[(i + 1) % sequence.length] || 'L';
            const type = (c1 + 'S' + c2) as any; // LSL, LSR ...

            const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

            // Push Tangent
            paths.push({
                type: type,
                length: dist,
                param1: 0, param2: dist, param3: 0,
                rho: Infinity, // Line
                start: { ...p1, theta: Math.atan2(p2.y - p1.y, p2.x - p1.x) }, // Tangent heading
                end: { ...p2, theta: Math.atan2(p2.y - p1.y, p2.x - p1.x) }
            });

            // 2. Arc on Disk 2 (Arrival -> Departure)
            // We optimize thetaIn and thetaOut on Disk 2.
            // The arc goes from thetaIn2 -> thetaOut2.
            // Chirality c2 determines direction.

            const nextIdx = (i + 1) % sequence.length;
            const stateNext = this.state.get(id2)!;

            // Skip arc if last point in open chain
            if (!closed && i === sequence.length - 2) continue; // Check logic

            // Calculate Arc Length
            const delta = stateNext.thetaOut - stateNext.thetaIn;
            // Normalize delta to match chirality direction
            // If L (CCW), delta should be positive? 
            // Our relaxation logic effectively unwraps theta, so (out - in) should naturally be the correct signed angle.
            // But for rendering, we need positive length.

            // Check winding compliance?
            // If C=L, we expect increasing angle.
            // If C=R, we expect decreasing angle.
            // We forced this in relaxation.

            const arcLen = Math.abs(delta) * disk2.visualRadius;

            // Only add if non-zero (or epsilon)
            if (arcLen > 1e-4) {
                paths.push({
                    type: c2 === 'L' ? 'LSL' : 'RSR', // Dummy type to signal curvature
                    length: arcLen,
                    param1: arcLen, param2: 0, param3: 0,
                    rho: disk2.visualRadius,
                    start: p2, // Arrival at Disk 2
                    end: { // Re-compute departure point to be exact
                        x: disk2.center.x + disk2.visualRadius * Math.cos(stateNext.thetaOut),
                        y: disk2.center.y + disk2.visualRadius * Math.sin(stateNext.thetaOut),
                        theta: stateNext.thetaOut
                    }
                });
            }
        }

        return paths;
    }

    private initializeState(sequence: string[], disks: CSDisk[], chiralities: ('L' | 'R')[]) {
        // If map is empty or sequence changed size/ids, reset or seed
        // We try to keep existing angles if disk ID matches (Temporal Coherence).

        sequence.forEach((id, i) => {
            if (!this.state.has(id)) {
                // Heuristic Seed: Point towards neighbors
                // (Naive initialization - first frame might be jumpy but relaxation fixes it fast)
                this.state.set(id, { thetaIn: 0, thetaOut: 0 });
            }
        });

        // Prune stale IDs
        for (const id of this.state.keys()) {
            if (!sequence.includes(id)) this.state.delete(id);
        }
    }

    private relaxDisk(
        diskId: string,
        prevId: string,
        nextId: string,
        diskMap: Map<string, CSDisk>,
        chirality: 'L' | 'R'
    ) {
        const disk = diskMap.get(diskId);
        const prevDisk = diskMap.get(prevId);
        const nextDisk = diskMap.get(nextId);
        if (!disk || !prevDisk || !nextDisk) return;

        const stateLocal = this.state.get(diskId)!;
        const statePrev = this.state.get(prevId)!;
        const stateNext = this.state.get(nextId)!;

        // 1. Get Geometric Targets (Points we are connecting TO)
        // We use the *current* contact points on neighbors as the targets.
        // This creates the coupled system.
        const P_prev = {
            x: prevDisk.center.x + prevDisk.visualRadius * Math.cos(statePrev.thetaOut),
            y: prevDisk.center.y + prevDisk.visualRadius * Math.sin(statePrev.thetaOut)
        };

        const P_next = {
            x: nextDisk.center.x + nextDisk.visualRadius * Math.cos(stateNext.thetaIn),
            y: nextDisk.center.y + nextDisk.visualRadius * Math.sin(stateNext.thetaIn)
        };

        // 2. Solve Optimal Tangent Angles
        // We want the point on 'disk' such that the line to P_prev is tangent.
        // Tangent depends on Side (Chirality relative to line).
        // Since the string wraps the disk with 'chirality', the tangent IS determined by that.
        // e.g. L (CCW): Incoming string is tangent such that Disk is on Left of string.

        const idealIn = this.calculateTangentAngle(disk, P_prev, chirality, true);
        const idealOut = this.calculateTangentAngle(disk, P_next, chirality, false);

        // 3. Update State (Damping optional, but direct set is usually stable for geometric)
        // Crucial: Maintain Winding (Unwrapping).
        // Ensure thetaOut is "after" thetaIn relative to chirality.

        const newIn = idealIn;
        let newOut = idealOut;

        // Unwrap checks
        if (chirality === 'L') {
            // CCW: Out > In
            while (newOut < newIn) newOut += 2 * Math.PI;
            while (newOut - newIn > 2 * Math.PI) newOut -= 2 * Math.PI; // Minimize loop?
            // If delta > 2PI, it's a full loop. Do we want that?
            // "Elastic" -> Minimize length -> Minimize Delta.
            // So we want smallest positive delta?
            // Yes, unless we track winding number explicitly. 
            // For now, assume simple wrapping (minimal positive arc).
        } else {
            // CW: Out < In
            while (newOut > newIn) newOut -= 2 * Math.PI;
            while (newIn - newOut > 2 * Math.PI) newOut += 2 * Math.PI;
        }

        // Apply
        stateLocal.thetaIn = newIn;
        stateLocal.thetaOut = newOut;
    }

    /**
     * Calculates the angle on the circle for a tangent line to/from Point P.
     * @param isIncoming true = P to Circle, false = Circle to P
     */
    private calculateTangentAngle(disk: CSDisk, P: { x: number, y: number }, chirality: 'L' | 'R', isIncoming: boolean): number {
        // Vector Center -> P
        const dx = P.x - disk.center.x;
        const dy = P.y - disk.center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angleToP = Math.atan2(dy, dx);

        // Angle offset for tangent: acos(R/dist)
        // If dist < R (inside), clamp or fallback (can't be tangent). 
        // Real elastic band penetrates. Tangent is undefined. 
        // Fallback: Point at P (AngleToP).
        if (dist <= disk.visualRadius) return angleToP;

        const offset = Math.acos(disk.visualRadius / dist);

        /*
           Chirality Logic:
           L (CCW): Center is Left of Line.
           Incoming (P -> C): 
              Vector P->A. Center is Left. 
              Angle is (AngleToP - offset) or (AngleToP + offset)?
              Visualizing: Circle at Origin. P at (0, -10). AngleToP = -90.
              Left Tangent (P->C) touches at roughly 0 degrees (Right side)? No, that leaves Center Right.
              Touches at 180 (Left side)? leaves Center Left.
              Let's use the Cross Product rule.
           
           Standard Tangents:
           T1 = AngleToP + Offset
           T2 = AngleToP - Offset
        */

        // Let's rely on standard Dubins logic simplifications:
        // L = + Offset, R = - Offset?
        // Wait, for LSL:
        // Start Circle: Leave L. Tangent is at +Offset (relative to line connecting centers?).

        let angle = 0;

        if (isIncoming) {
            // P -> Circle. 
            // L: Center Left of vector.
            // Tangent point is "Right" of the radial line? 
            // Angle = AngleToP - Offset ??
            // Let's test. P=(10,0). C=(0,0). AngleToP=0.
            // L tangent (P->C) comes from right, touches 'Top' (PI/2)?
            // Vector (10,0)->(0,1). (-10, 1). Cross z > 0 (Left). Correct.
            // So Angle = PI/2.
            // AngleToP (0) + Offset (PI/2).
            // So Incoming L = + Offset. 
            if (chirality === 'L') angle = angleToP + offset;
            else angle = angleToP - offset;
        } else {
            // Circle -> P.
            // L: Center Left of vector.
            // C=(0,0). P=(10,0). AngleToP=0.
            // Vector C->P is (1,0).
            // Tangent point must be 'Bottom' (-PI/2)? Vector (0,-1)->(10,0). (10, 1). Left.
            // So Angle = -PI/2.
            // AngleToP (0) - Offset (PI/2).
            // So Outgoing L = - Offset.
            if (chirality === 'L') angle = angleToP - offset;
            else angle = angleToP + offset;
        }

        return angle;
    }
}
