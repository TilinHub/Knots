import type { CSDisk } from '../../../core/types/cs';
import type { EnvelopeSegment } from '../../../core/geometry/contactGraph';
import { computeRobustConvexHull } from '../../../core/geometry/robustHull';
import { findEnvelopePath, buildBoundedCurvatureGraph } from '../../../core/geometry/contactGraph';

/**
 * Computes the "Robust" envelope for Knot Mode.
 * Wraps the new `computeRobustConvexHull` logic but prefers explicit topology (sequence + chiralities) if available.
 */
export class KnotEnvelopeComputer {
    private lastGoodEnvelope: EnvelopeSegment[] = [];

    compute(disks: CSDisk[], sequence?: string[], chiralities?: string[]): EnvelopeSegment[] {
        if (!disks || disks.length === 0) return [];

        // 1. Priority: Topology-Aware Elastic Band (if sequence exists)
        // This ensures the envelope follows the user's defined knot path ("elastic band")
        // allowing it to slide along the disk surfaces (tangents) rather than being pinned to anchor points.
        if (sequence && sequence.length >= 2 && chiralities && chiralities.length > 0) {
            try {
                const contactDisks = disks.map(d => ({
                    id: d.id,
                    center: d.center,
                    radius: d.visualRadius,
                    regionId: 'default'
                }));

                // Build the graph of all possible outer tangents
                // strict=true (no intersections), limited to sequence? No, build full graph.
                const graph = buildBoundedCurvatureGraph(contactDisks, true);

                // Use the sequence and chiralities to find the best path through the graph
                // This corresponds to the user's "Green Check" logic (sliding band).
                const result = findEnvelopePath(graph, sequence, chiralities as any, false);

                if (result.path && result.path.length > 0) {
                    this.lastGoodEnvelope = result.path;
                    return result.path;
                }

                // Fallback: If strict chirality failed (e.g. impossible winding),
                // try "Relaxed Elastic Band" - respect sequence but optimize winding (shortest path).
                // This stabilizes the behavior when dragging creates temporary impossibilities.
                const relaxedResult = findEnvelopePath(graph, sequence);
                if (relaxedResult.path && relaxedResult.path.length > 0) {
                    // console.warn("KnotEnvelope: Strict chirality failed, using relaxed elastic band");
                    this.lastGoodEnvelope = relaxedResult.path;
                    return relaxedResult.path;
                }
            } catch (e) {
                console.warn("KnotEnvelope: Elastic Band failed, falling back to Hull", e);
            }
        }

        // 2. Fallback: Robust Convex Hull (Cloud)
        // If no sequence defined, or if elastic band fails completely
        const result = computeRobustConvexHull(disks);

        if (result.ok) {
            // Only update lastGood if we are purely in hull mode or if elastic failed completely
            if (!sequence || sequence.length < 2) {
                this.lastGoodEnvelope = result.path;
            }
            return result.path;
        } else {
            // console.warn("KnotEnvelope failure:", result.reason, result.debug);
            if (result.fallbackPath && result.fallbackPath.length > 0) {
                return result.fallbackPath;
            }
            return this.lastGoodEnvelope; // Keep last known good state
        }
    }
}
