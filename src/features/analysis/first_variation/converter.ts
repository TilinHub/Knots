/**
 * Converter from Editor State to Protocol CSDiagram
 */

import type { CSDisk } from '../../../core/types/cs';
import type { CSDiagram, Disk, Contact, Tangency, Segment, Arc, Point } from './types';
import { dist, wrap0_2pi, calculateDeltaTheta } from './geometry';

// Internal types for the converter
type DiskIdToIndex = Map<string, number>;

export function convertEditorToProtocol(
    editorDisks: CSDisk[],
    sequenceIds: string[],
    options: { tolerance: number } = { tolerance: 1e-4 }
): CSDiagram {

    // 1. Convert Disks
    const disks: Disk[] = [];
    const diskIdToIndex: DiskIdToIndex = new Map();

    // Scale based on first disk radius to enforce R=1
    const refRadius = editorDisks[0]?.radius || 1;
    const scaleFactor = 1 / refRadius;

    editorDisks.forEach((d, i) => {
        disks.push({
            index: i,
            center: { x: d.center.x * scaleFactor, y: d.center.y * scaleFactor }
        });
        diskIdToIndex.set(d.id, i);
    });

    // 2. Detect Contacts
    const contacts: Contact[] = [];

    // NOTE regarding tolerance: Editor uses large coordinates.
    // With scaleFactor (e.g. 1/100), tolerance should be small (e.g. 1e-4).
    // 1e-4 in R=1 unit is 0.01px in R=100 unit. Good.

    for (let i = 0; i < disks.length; i++) {
        for (let j = i + 1; j < disks.length; j++) {
            const d1 = disks[i];
            const d2 = disks[j];
            const d = dist(d1.center, d2.center);
            // Contact if distance is approx 2
            if (Math.abs(d - 2) < 0.1) {
                contacts.push({ diskA: i, diskB: j });
            }
        }
    }

    // 3. Reconstruct Path (Tangencies, Segments, Arcs)
    const tangencies: Tangency[] = [];
    const segments: Segment[] = [];
    const arcs: Arc[] = [];

    if (sequenceIds.length < 2) {
        return createEmptyDiagram(disks, contacts);
    }

    let tangencyCount = 0;

    const numSteps = sequenceIds.length - (sequenceIds[0] === sequenceIds[sequenceIds.length - 1] ? 1 : 0);

    // 1. Calculate all Segments (PointOut, PointIn)
    // 2. Build Arcs between Segment[i].In and Segment[i+1].Out

    interface TempSegment {
        d1Idx: number;
        d2Idx: number;
        pOut: Point;
        pIn: Point;
    }

    const tempSegments: TempSegment[] = [];

    for (let i = 0; i < numSteps; i++) {
        const id1 = sequenceIds[i];
        const id2 = sequenceIds[(i + 1) % numSteps];
        if (!diskIdToIndex.has(id1) || !diskIdToIndex.has(id2)) return createEmptyDiagram(disks, contacts);

        const idx1 = diskIdToIndex.get(id1)!;
        const idx2 = diskIdToIndex.get(id2)!;
        const d1 = disks[idx1];
        const d2 = disks[idx2];

        const dx = d2.center.x - d1.center.x;
        const dy = d2.center.y - d1.center.y;
        const baseAngle = Math.atan2(dy, dx);
        const tangentAngle = baseAngle + Math.PI / 2; // CCW Outer Tangent

        const pOut = { x: d1.center.x + Math.cos(tangentAngle), y: d1.center.y + Math.sin(tangentAngle) };
        const pIn = { x: d2.center.x + Math.cos(tangentAngle), y: d2.center.y + Math.sin(tangentAngle) };

        tempSegments.push({ d1Idx: idx1, d2Idx: idx2, pOut, pIn });
    }

    // Now reconstruct protocol objects
    tangencies.length = 0; // Clear
    tangencyCount = 0;

    // We need to link Seg k and Seg k+1.
    // Seg k connects D_i -> D_{i+1}
    // Seg k+1 connects D_{i+1} -> D_{i+2}
    // Arc connects Segk.pIn (on D_{i+1}) -> Seg(k+1).pOut (on D_{i+1})

    // Store tangency IDs created
    const segIds: { start: string, end: string, dStart: number, dEnd: number }[] = [];

    tempSegments.forEach(ts => {
        const tOutId = `t${tangencyCount++}`;
        const tInId = `t${tangencyCount++}`;

        tangencies.push({ id: tOutId, diskIndex: ts.d1Idx, point: ts.pOut });
        tangencies.push({ id: tInId, diskIndex: ts.d2Idx, point: ts.pIn });

        segments.push({ startTangencyId: tOutId, endTangencyId: tInId });
        segIds.push({ start: tOutId, end: tInId, dStart: ts.d1Idx, dEnd: ts.d2Idx });
    });

    // Create Arcs
    for (let i = 0; i < segIds.length; i++) {
        const currentSeg = segIds[i];
        const nextSeg = segIds[(i + 1) % segIds.length];

        // Arc on D_end of current = D_start of next
        // Valid only if D_end == D_start (continuity)
        if (currentSeg.dEnd !== nextSeg.dStart) {
            // Discontinuous sequence? Should not happen if closed loop logic holds.
            continue;
        }

        const dIndex = currentSeg.dEnd;
        const tStartId = currentSeg.end; // Incoming tangency
        const tEndId = nextSeg.start;    // Outgoing tangency

        const pStart = tangencies.find(t => t.id === tStartId)!.point;
        const pEnd = tangencies.find(t => t.id === tEndId)!.point;

        const deltaTheta = calculateDeltaTheta(pStart, pEnd, disks[dIndex].center);

        arcs.push({
            startTangencyId: tStartId,
            endTangencyId: tEndId,
            diskIndex: dIndex,
            deltaTheta
        });
    }

    return {
        disks,
        contacts,
        tangencies,
        segments,
        arcs,
        tolerances: { met: 1e-4, geo: 1e-4, lin: 1e-6 }
    };
}

function createEmptyDiagram(disks: Disk[], contacts: Contact[]): CSDiagram {
    return {
        disks,
        contacts,
        tangencies: [],
        segments: [],
        arcs: [],
        tolerances: { met: 1e-4, geo: 1e-4, lin: 1e-6 }
    };
}
