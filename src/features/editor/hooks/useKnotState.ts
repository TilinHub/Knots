import { useState, useCallback } from 'react';
import type { KnotDiagram, Point3D } from '../../../core/types/knot';
import type { CSBlock, CSDisk } from '../../../core/types/cs';
import { computeDiskHull } from '../../../core/geometry/diskHull';
// We might need a conversion utility later, for now we assume we can build a minimal diagram
// from the visual envelope.

interface UseKnotStateProps {
    initialBlocks?: CSBlock[];
}

export function useKnotState({ initialBlocks = [] }: UseKnotStateProps = {}) {
    const [mode, setMode] = useState<'hull' | 'knot'>('hull');
    const [knot, setKnot] = useState<KnotDiagram | null>(null);

    // We need to import computeDiskHull and types inside the hook or module
    // But since this is a replacing block, assume imports are added at the top or we will add them.

    const initFromHull = useCallback((blocks: CSBlock[]) => {
        const disks = blocks.filter((b): b is CSDisk => b.kind === 'disk');
        if (disks.length < 2) return;

        // Convert CSDisk to generic Disk format for algorithm
        const simpleDisks = disks.map(d => ({
            id: d.id,
            x: d.center.x,
            y: d.center.y,
            r: d.visualRadius
        }));

        // Compute the hull
        const hull = computeDiskHull(simpleDisks);
        if (!hull.segments || hull.segments.length === 0) return;

        // Convert hull segments to control points for the knot
        const points: Point3D[] = [];

        hull.segments.forEach(seg => {
            if (seg.type === 'tangent') {
                points.push({ x: seg.from.x, y: seg.from.y, z: 0 });
                // We exclude 'to' because it will be the start of the next segment (or close to it)
                // actually in this specific structure (interleaved), arc starts exactly where tangent ends.
            } else if (seg.type === 'arc') {
                // Approximate arc with a few points
                // 3 points for the arc: start, middle, end (end handled by next)
                points.push({ x: seg.startPoint.x, y: seg.startPoint.y, z: 0 });

                // Add a midpoint for better shape preservation if needed, 
                // but for now let's just use start/end for linear approximation 
                // or investigate if we want true curves. 
                // KnotRenderer currently does L (Linear). 
                // Let's add more intermediate points for arcs.
                const midAngle = (seg.startAngle + seg.endAngle) / 2; // Be careful with wrapping
                // This angle calc is naive, depends on arc direction. 
                // Hull is always CCW or CW? computeDiskHull returns CCW.

                // Let's just trust the segment endpoints for a rough polyline first.
            }
        });

        // Create a simple closed loop knot diagram
        const newKnot: KnotDiagram = {
            id: `k${Date.now()}`,
            knotId: 'unknot',
            embedding: {
                id: `embed-${Date.now()}`,
                type: 'closed_path',
                controlPoints: points,
                arcLength: 0,
                crossingCount: 0
            },
            crossings: [],
            regions: [],
            reidemeisterMoves: [],
            isMinimal: true,
            crossingNumber: 0
        };

        setKnot(newKnot);
        setMode('knot');
    }, []);

    const toggleMode = useCallback(() => {
        setMode(prev => prev === 'hull' ? 'knot' : 'hull');
    }, []);

    const applyTwist = useCallback((segmentIndex: number) => {
        if (!knot || !knot.embedding.controlPoints) return;

        const points = [...knot.embedding.controlPoints];
        if (segmentIndex < 0 || segmentIndex >= points.length) return;

        const p1 = points[segmentIndex];
        const p2 = points[(segmentIndex + 1) % points.length];

        // Simple Geometric "Kink" (Type I precursor)
        // Insert a point that creates a small loop.
        // For now, let's just insert a point offset by normal vector to visually deform.
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len;
        const ny = dx / len;

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        // Push out by 50 units
        const newPoint = {
            x: midX + nx * 50,
            y: midY + ny * 50,
            z: 0
        };

        // Insert new point
        points.splice(segmentIndex + 1, 0, newPoint);

        setKnot({
            ...knot,
            embedding: {
                ...knot.embedding,
                controlPoints: points
            }
        });

    }, [knot]);

    const applyPoke = useCallback(() => {
        // Type II move implementation
        console.log('Apply Poke');
    }, []);

    return {
        mode,
        knot,
        actions: {
            setMode,
            toggleMode,
            initFromHull,
            applyTwist,
            applyPoke
        }
    };
}
