/**
 * Converter from Editor State to Protocol CSDiagram
 */

import { buildBoundedCurvatureGraph, calculateBitangents, findEnvelopePath, findEnvelopePathFromPoints } from '../../../core/geometry/contactGraph'; // [Updated Import]
import type { CSDisk, Point2D } from '../../../core/types/cs';
import type { DynamicAnchor } from '../../knot/logic/useKnotState';
import { calculateDeltaTheta, dist, wrap0_2pi } from './geometry';
import type { Arc, Contact, CSDiagram, Disk, Point, Segment, Tangency } from './types';

// Internal types for the converter
type DiskIdToIndex = Map<string, number>;

export interface ConverterOptions {
    tolerance: number;
    chiralities?: ('L' | 'R')[];
    anchorSequence?: DynamicAnchor[];
    frozenPath?: any[];  // Saved path topology for exact reconstruction
}

export function convertEditorToProtocol(
    editorDisks: CSDisk[],
    sequenceIds: string[],
    options: ConverterOptions = { tolerance: 1e-4 }
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

    // 3. Reconstruct Path using findEnvelopePath (Geometry Core)
    // This allows supporting Inner/Outer tangents, Mixed chiralities, and complex paths.

    const contactDisks = disks.map(d => ({
        id: d.index.toString(),
        center: d.center,
        radius: 1, // Protocol enforces R=1 scaled
        regionId: '0'
    }));

    // 4. Reconstruct Path
    let result: { path: any[], chiralities: ('L' | 'R')[] } | null = null;

    // PRIMARY: Use frozenPath if available — reconstructs from saved topology
    // using current disk positions at R=1 scale. This guarantees the analysis
    // matches the displayed envelope exactly.
    if (options.frozenPath && options.frozenPath.length > 0) {
        const reconstructedPath: any[] = [];

        for (const seg of options.frozenPath) {
            if (seg.type === 'ARC') {
                // Arc segment: map editor disk ID → index, use R=1 center
                const editorDiskId = seg.diskId;
                const diskIdx = diskIdToIndex.get(editorDiskId);
                if (diskIdx === undefined) continue;

                const disk = disks[diskIdx];
                // Compute angular length
                let arcLen = seg.endAngle - seg.startAngle;
                if (seg.chirality === 'L') {
                    while (arcLen <= 0) arcLen += 2 * Math.PI;
                } else {
                    while (arcLen >= 0) arcLen -= 2 * Math.PI;
                    arcLen = Math.abs(arcLen);
                }

                reconstructedPath.push({
                    type: 'ARC',
                    center: disk.center,
                    radius: 1,
                    startAngle: seg.startAngle,
                    endAngle: seg.endAngle,
                    chirality: seg.chirality,
                    length: arcLen,
                    diskId: diskIdx.toString()
                });
            } else {
                // Tangent segment: recompute bitangent of same type at R=1 scale
                const startId = seg._startDiskId || seg.startDiskId;
                const endId = seg._endDiskId || seg.endDiskId;
                const startIdx = diskIdToIndex.get(startId);
                const endIdx = diskIdToIndex.get(endId);
                if (startIdx === undefined || endIdx === undefined) continue;

                const d1 = { id: startIdx.toString(), center: disks[startIdx].center, radius: 1, regionId: '0', color: '' };
                const d2 = { id: endIdx.toString(), center: disks[endIdx].center, radius: 1, regionId: '0', color: '' };

                const tangents = calculateBitangents(d1, d2);
                const match = tangents.find((t: any) => t.type === seg.type);

                if (match) {
                    reconstructedPath.push({
                        ...match,
                        startDiskId: startIdx.toString(),
                        endDiskId: endIdx.toString()
                    });
                }
            }
        }

        result = { path: reconstructedPath, chiralities: options.chiralities || [] };

    } else if (options.anchorSequence && options.anchorSequence.length >= 2) {
        // Anchors-based pathfinding (Knot Mode)
        const anchorPoints: Point2D[] = options.anchorSequence.map(da => {
            const disk = editorDisks.find(d => d.id === da.diskId);
            if (!disk) return { x: 0, y: 0 };
            const scaledCenter = diskIdToIndex.has(da.diskId)
                ? disks[diskIdToIndex.get(da.diskId)!].center
                : { x: 0, y: 0 };
            return {
                x: scaledCenter.x + 1 * Math.cos(da.angle),
                y: scaledCenter.y + 1 * Math.sin(da.angle)
            };
        });

        const anchorContactDisks = disks.map(d => ({
            id: d.index.toString(),
            center: d.center,
            radius: 1,
            regionId: '0'
        }));

        result = findEnvelopePathFromPoints(anchorPoints, anchorContactDisks);

    } else {
        // Fallback: solve from sequence + chiralities
        const diskIds = sequenceIds.map(id => {
            const idx = diskIdToIndex.get(id);
            return idx !== undefined ? idx.toString() : '0';
        });
        const chiralities = options.chiralities;

        const seqContactDisks = disks.map(d => ({
            id: d.index.toString(),
            center: d.center,
            radius: 1,
            regionId: '0'
        }));
        const graph = buildBoundedCurvatureGraph(seqContactDisks, false);
        result = findEnvelopePath(graph, diskIds, chiralities, false);
    }

    const tangencies: Tangency[] = [];
    const segments: Segment[] = [];
    const arcs: Arc[] = [];

    if (!result || result.path.length === 0) {
        return createEmptyDiagram(disks, contacts);
    }

    let tCount = 0;
    const createTangency = (pt: Point, dIdx: number) => {
        const id = `t${tCount++}`;
        tangencies.push({ id, diskIndex: dIdx, point: pt });
        return id;
    };

    let lastTangencyId: string | null = null;
    let firstTangencyId: string | null = null;

    for (let i = 0; i < result.path.length; i++) {
        const item = result.path[i];

        if (item.type === 'ARC') {
            // Arcs are handled by connecting Segments
            continue;
        } else {
            // Tangent Segment
            const dStartIdx = parseInt(item.startDiskId);
            const dEndIdx = parseInt(item.endDiskId);

            const tStartId = createTangency(item.start, dStartIdx);
            const tEndId = createTangency(item.end, dEndIdx);

            if (firstTangencyId === null) firstTangencyId = tStartId;

            // Connect from previous segment with an Arc
            if (lastTangencyId) {
                const prevItem = result.path[i - 1];
                let deltaTheta = 0;

                if (prevItem && prevItem.type === 'ARC') {
                    deltaTheta = prevItem.length;
                } else {
                    deltaTheta = 0;
                }

                arcs.push({
                    startTangencyId: lastTangencyId,
                    endTangencyId: tStartId,
                    diskIndex: dStartIdx,
                    deltaTheta: Math.max(1e-6, deltaTheta)
                });
            }

            segments.push({
                startTangencyId: tStartId,
                endTangencyId: tEndId
            });

            lastTangencyId = tEndId;
        }
    }

    // Close the loop
    if (lastTangencyId && firstTangencyId) {
        const lastItem = result.path[result.path.length - 1];
        let deltaTheta = 0;
        let closeDiskIndex = 0;

        if (lastItem.type === 'ARC') {
            deltaTheta = lastItem.length;
            // ArcSegment has diskId
            closeDiskIndex = parseInt(lastItem.diskId);
        } else {
            // Tangent Segment
            const pLast = tangencies.find(t => t.id === lastTangencyId)!.point;
            const pFirst = tangencies.find(t => t.id === firstTangencyId)!.point;
            // TangentSegment has endDiskId
            closeDiskIndex = parseInt(lastItem.endDiskId);

            deltaTheta = calculateDeltaTheta(pLast, pFirst, disks[closeDiskIndex].center);
        }

        arcs.push({
            startTangencyId: lastTangencyId,
            endTangencyId: firstTangencyId,
            diskIndex: closeDiskIndex,
            deltaTheta: Math.max(1e-6, deltaTheta)
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
