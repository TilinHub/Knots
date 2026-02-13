
import type { CSDisk } from '../../../core/types/cs';
import type { ContactGraph, DiskContact } from '../../../core/types/contactGraph';
import type { DubinsPath } from '../../../core/geometry/dubins';
import { type ContactPointWithRange, type AngularRange, type AngularSamplingConfig, computeDubinsWithRanges } from '../../../math/dubins/AngularRangeDubins';

export class EnvelopePathCalculator {
    private samplingConfig: AngularSamplingConfig;

    constructor(config?: Partial<AngularSamplingConfig>) {
        this.samplingConfig = {
            numSamples: config?.numSamples ?? 7, // Default 7 samples
            minRadius: config?.minRadius ?? 1.0,
        };
    }

    /**
     * Calculates the flexible envelope path for a full knot sequence.
     * Respects the given sequence of disks and chiralities.
     * 
     * @param disks - All available disks
     * @param sequence - Ordered list of disk IDs
     * @param chiralities - Ordered list of 'L' | 'R' for each disk in the sequence
     * @param closed - Whether the path should loop back to start (default true)
     */
    public calculateKnotPath(
        disks: CSDisk[],
        sequence: string[],
        chiralities: ('L' | 'R')[],
        closed: boolean = true
    ): DubinsPath[] {
        const paths: DubinsPath[] = [];
        if (sequence.length < 2) return paths;

        const diskMap = new Map<string, CSDisk>();
        disks.forEach(d => diskMap.set(d.id, d));

        const numSegments = closed ? sequence.length : sequence.length - 1;

        for (let i = 0; i < numSegments; i++) {
            const id1 = sequence[i];
            const id2 = sequence[(i + 1) % sequence.length];
            const disk1 = diskMap.get(id1);
            const disk2 = diskMap.get(id2);

            if (!disk1 || !disk2) continue;

            // Get Chiralities
            const c1 = chiralities[i] || 'L'; // Default Left
            const c2 = chiralities[(i + 1) % sequence.length] || 'L';

            const path = this.computeConnectionWithChirality(disk1, c1, disk2, c2);
            if (path) {
                paths.push(path);
            }
        }

        return paths;
    }

    /**
     * Computes a connection between two disks enforcing specific departure/arrival chiralities.
     * 
     * @param disk1 - Start Disk
     * @param chiral1 - Departure Chirality ('L' = CCW, 'R' = CW)
     * @param disk2 - End Disk
     * @param chiral2 - Arrival Chirality ('L' = CCW, 'R' = CW)
     */
    public computeConnectionWithChirality(
        disk1: CSDisk,
        chiral1: 'L' | 'R',
        disk2: CSDisk,
        chiral2: 'L' | 'R'
    ): DubinsPath | null {
        // 1. Determine Nominal Angles (Center to Center)
        const angle12 = Math.atan2(disk2.center.y - disk1.center.y, disk2.center.x - disk1.center.x);

        // 2. Define Angular Ranges centered on the "Natural" tangent point for that chirality?
        // Actually, AngularRangeDubins explores a range around a center.
        // If we want L->L (Outer), the contact points are approx orthogonal to the connector.
        // But 'computeDubinsWithRanges' will generate candidates. 
        // We just need to FILTER the candidates based on their type.

        // Let's search a WIDE range (e.g. +/- 90 degrees from connection line) to find the tangent?
        // Or better: The defined range is "where the tape touches the disk".
        // For LSL, touches are at +PI/2 relative to connection. 
        // For RSR, touches are at -PI/2.
        // For Cross, they vary.

        // Instead of guessing the range center, let's use a wide range relative to the connector 
        // and filter the *result* path type.

        // Dubins Types:
        // LSL: Leaves L, Arrives L
        // LSR: Leaves L, Arrives R
        // RSL: Leaves R, Arrives L
        // RSR: Leaves R, Arrives R

        // Mapping:
        // L -> L : LSL (and LRL if we allow 3 segments)
        // L -> R : LSR
        // R -> L : RSL
        // R -> R : RSR (and RLR)

        // 2. Define Angular Ranges based on Chirality
        // We center the search range on the "Left" or "Right" hemisphere relative to the connection line.
        // This ensures we sample the relevant sectors (0, 90, 180 degrees relative to line) which contain 
        // the standard Inner and Outer tangents.

        // Vector D1 -> D2 is angle12.
        // 'L' (Left/CCW) favors the "Left" side (angle12 + PI/2)
        // 'R' (Right/CW) favors the "Right" side (angle12 - PI/2)

        // Start Range
        const center1 = chiral1 === 'L' ? angle12 + Math.PI / 2 : angle12 - Math.PI / 2;
        const range1: AngularRange = { center: center1, delta: Math.PI / 2 };

        // End Range
        // For the destination disk, we use the same relativity to the connection line D1->D2.
        // LSL (Left->Left) uses Top->Top tangents (+90 -> +90 relative to D1->D2).
        // LSR (Left->Right) uses Top->Bottom tangents (+90 -> -90 relative to D1->D2).
        const center2 = chiral2 === 'L' ? angle12 + Math.PI / 2 : angle12 - Math.PI / 2;
        const range2: AngularRange = { center: center2, delta: Math.PI / 2 };

        const start: ContactPointWithRange = { disk: { center: disk1.center, radius: disk1.visualRadius }, range: range1 };
        const end: ContactPointWithRange = { disk: { center: disk2.center, radius: disk2.visualRadius }, range: range2 };

        // Generate ALL candidates
        const candidates = computeDubinsWithRanges(start, end, this.samplingConfig);

        // Filter by Chirality
        // We check if the Dubins Path Type starts with chiral1 and ends with chiral2.
        const validCandidates = candidates.filter(p => {
            const type = p.type; // e.g. 'LSL'
            const startType = type.charAt(0); // 'L'
            const endType = type.charAt(2); // 'L'
            return startType === chiral1 && endType === chiral2;
        });

        return validCandidates.length > 0 ? validCandidates[0] : null;
    }

    /**
     * Calculates the flexible envelope path for the given disks and contact graph.
     * This involves iterating through the sequence of connected disks and finding optimum Dubins paths.
     * 
     * Note: This is a simplified version that processes each connection independently.
     * For a global optimum, we would need dynamic programming or a graph search, 
     * but independent optimization is a good first step for "Flexible Envelope".
     */
    public calculateFlexibleEnvelope(
        disks: CSDisk[],
        contacts: DiskContact[]
    ): DubinsPath[] {

        const paths: DubinsPath[] = [];

        // Map disks by ID for easy efficient
        const diskMap = new Map<string, CSDisk>();
        disks.forEach(d => diskMap.set(d.id, d));

        // We assume 'contacts' are ordered or we just process them as edges.
        // If we want a continuous envelope, we need to follow the cycle.
        // For now, let's just process the given contacts list as a sequence of needed connections.

        for (const contact of contacts) {
            const disk1 = diskMap.get(contact.disk1);
            const disk2 = diskMap.get(contact.disk2);

            if (!disk1 || !disk2) continue;

            // Determine nominal contact angle
            // Vector from disk1 to disk2
            const dx = disk2.center.x - disk1.center.x;
            const dy = disk2.center.y - disk1.center.y;
            const nominalAngle1 = Math.atan2(dy, dx);
            // Contact on disk2 is usually opposite
            const nominalAngle2 = Math.atan2(-dy, -dx);

            // Define Angular Ranges
            // We use a default +/- 30 degrees (PI/6)
            const range1: AngularRange = {
                center: nominalAngle1,
                delta: Math.PI / 6
            };

            const range2: AngularRange = {
                center: nominalAngle2,
                delta: Math.PI / 6
            };

            // Construct Contact Configurations
            const startContact: ContactPointWithRange = {
                disk: { center: disk1.center, radius: disk1.visualRadius }, // Use visual radius
                range: range1
            };

            const endContact: ContactPointWithRange = {
                disk: { center: disk2.center, radius: disk2.visualRadius },
                range: range2
            };

            // Compute Paths
            const candidates = computeDubinsWithRanges(
                startContact,
                endContact,
                this.samplingConfig
            );

            // Filter valid paths (collision check would go here)
            // For now, take the shortest valid one
            if (candidates.length > 0) {
                // Prefer CCC paths if they are close in length to CSC?
                // Let's just take the absolute shortest for now.
                paths.push(candidates[0]);
            }
        }

        return paths;
    }

    /**
     * Computes a single connection between two disks with flexibility.
     */
    public computeConnection(
        disk1: CSDisk,
        disk2: CSDisk,
        nominalAngle1?: number
    ): DubinsPath | null {
        // Vector from disk1 to disk2 if angle not provided
        let angle1 = nominalAngle1;
        if (angle1 === undefined) {
            angle1 = Math.atan2(disk2.center.y - disk1.center.y, disk2.center.x - disk1.center.x);
        }

        const angle2 = Math.atan2(disk1.center.y - disk2.center.y, disk1.center.x - disk2.center.x);

        const range1: AngularRange = { center: angle1, delta: Math.PI / 6 };
        const range2: AngularRange = { center: angle2, delta: Math.PI / 6 };

        const start: ContactPointWithRange = { disk: { center: disk1.center, radius: disk1.visualRadius }, range: range1 };
        const end: ContactPointWithRange = { disk: { center: disk2.center, radius: disk2.visualRadius }, range: range2 };

        const candidates = computeDubinsWithRanges(start, end, this.samplingConfig);
        return candidates.length > 0 ? candidates[0] : null;
    }
}
