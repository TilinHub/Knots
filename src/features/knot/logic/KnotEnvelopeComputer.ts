import type { EnvelopeComputer } from '../../../core/geometry/EnvelopeComputer';
import type { CSDisk } from '../../../core/types/cs';
import type { EnvelopeSegment } from '../../../core/geometry/contactGraph';
import { computeRobustConvexHull } from '../../../core/geometry/robustHull';

/**
 * Computes the "Robust" envelope for Knot Mode.
 * Wraps the new `computeRobustConvexHull` logic.
 */
export class KnotEnvelopeComputer implements EnvelopeComputer {
    compute(disks: CSDisk[], _modeContext?: any): EnvelopeSegment[] {
        if (!disks || disks.length === 0) return [];
        const contactDisks = disks.map(d => ({
            ...d,
            radius: d.visualRadius,
            regionId: 'default'
        }));
        return computeRobustConvexHull(contactDisks);
    }
}
