import type { EnvelopeComputer } from '../../../core/geometry/EnvelopeComputer';
import type { CSDisk } from '../../../core/types/cs';
import type { EnvelopeSegment } from '../../../core/geometry/contactGraph';
import { computeOuterContour } from '../../../core/geometry/outerFace';

/**
 * Computes the "Standard" envelope for the Editor.
 * Wraps the original `computeOuterContour` logic.
 */
export class EditorEnvelopeComputer implements EnvelopeComputer {
    compute(disks: CSDisk[], _modeContext?: any): EnvelopeSegment[] {
        if (!disks || disks.length === 0) return [];
        // Map to ContactDisk (requires regionId)
        const contactDisks = disks.map(d => ({
            ...d,
            radius: d.visualRadius, // Ensure radius is set if missing, CSDisk usually has visualRadius
            regionId: 'default'
        }));
        return computeOuterContour(contactDisks);
    }
}
