import type { DubinsPath } from '../../../core/geometry/dubins';
import {
  type AngularRange,
  type AngularSamplingConfig,
  computeDubinsWithRanges,
  calculateBitangentPaths,
  type ContactPointWithRange,
} from '../../../core/geometry/dubins';
import type { ContactGraph, DiskContact } from '../../../core/types/contactGraph';
import type { CSDisk } from '../../../core/types/cs';

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
    closed: boolean = true,
  ): DubinsPath[] {
    const paths: DubinsPath[] = [];
    if (sequence.length < 2) return paths;

    const diskMap = new Map<string, CSDisk>();
    disks.forEach((d) => diskMap.set(d.id, d));

    const numSegments = closed ? sequence.length : sequence.length - 1;
    const potentialPaths: (DubinsPath | null)[] = [];

    // 1. Compute all tangential connections first
    for (let i = 0; i < numSegments; i++) {
      const id1 = sequence[i];
      const id2 = sequence[(i + 1) % sequence.length];
      const disk1 = diskMap.get(id1);
      const disk2 = diskMap.get(id2);

      if (!disk1 || !disk2) {
        potentialPaths.push(null);
        continue;
      }

      const c1 = chiralities[i] || 'L';
      const c2 = chiralities[(i + 1) % sequence.length] || 'L';

      // Optimizes the connection A->B (likely a straight line if radii are equal)
      const path = this.computeConnectionWithChirality(disk1, c1, disk2, c2);
      potentialPaths.push(path);
    }

    // 2. Stitch them together with Arcs
    for (let i = 0; i < numSegments; i++) {
      const currentPath = potentialPaths[i];
      if (!currentPath) continue;

      // Add the Connection (Tangents)
      paths.push(currentPath);

      // Now compute the ARC on the destination disk (disk2)
      // It connects [Current Path End] -> [Next Path Start]

      // Next path index
      const nextIndex = (i + 1) % numSegments;
      // If not closed and this is the last segment, strictly no arc needed?
      // But if closed, we wrap around.
      if (!closed && i === numSegments - 1) continue;

      const nextPath = potentialPaths[nextIndex];
      if (nextPath) {
        // The disk in between is sequence[(i+1)]
        const intermediateDiskId = sequence[(i + 1) % sequence.length];
        const disk = diskMap.get(intermediateDiskId);
        const chirality = chiralities[(i + 1) % sequence.length] || 'L';

        if (disk) {
          const startAngle = currentPath.end.theta; // Arrival heading
          // Departure heading (nextPath.start.theta)
          // Note: Dubins coordinates are (x, y, theta).
          // For a circle, the tangent point is at theta +/- PI/2 depending on chirality?
          // Wait, DubinsPath.end.theta is the heading OF THE PATH.
          // The contact point on the disk is what matters.
          // But Dubins solver ensures continuity of position.

          // We need a path that goes from currentPath.end -> nextPath.start
          // These should be two points ON THE SAME DISK.
          // We just need to draw an ARC between them.

          // Create a "Pure Arc" DubinsPath
          // We can fake it or use a specific format.
          // Let's create a custom DubinsPath that DubinsRenderer will interpret as an Arc.
          // Or we can assume DubinsRenderer just draws segments?
          // DubinsRenderer draws based on 'type' and 'params'.
          // If we want a pure arc, we can use a dummy type 'LSL' with length 0 straght?
          // Better: construct a valid single-arc path.

          // We need the arc length and direction.
          // Angle from Center to StartPoint
          const a1 = Math.atan2(
            currentPath.end.y - disk.center.y,
            currentPath.end.x - disk.center.x,
          );
          // Angle from Center to EndPoint
          const a2 = Math.atan2(nextPath.start.y - disk.center.y, nextPath.start.x - disk.center.x);

          // Calculate Arc Length based on Chirality
          // L = CCW, R = CW
          let delta = a2 - a1;
          const EPSILON = 1e-5;
          if (chirality === 'L') {
            while (delta <= EPSILON) delta += 2 * Math.PI;
          } else {
            while (delta >= -EPSILON) delta -= 2 * Math.PI;
          }

          // Arc Length = |delta| * R
          const arcLen = Math.abs(delta) * disk.visualRadius;

          if (arcLen > 1e-4) {
            paths.push({
              type: chirality === 'L' ? 'LSL' : 'RSR', // Dummy type, but indicates curvature
              length: arcLen,
              // We can use param1 for the arc, param2=0, param3=0
              param1: arcLen,
              param2: 0,
              param3: 0,
              rho: disk.visualRadius,
              start: currentPath.end,
              end: nextPath.start,
              // Special flag or implicit?
              // If param2 is 0, it's essentially Curve-Curve?
              // Actually, LSL with p=0 is L + L = valid.
              // But we just want ONE arc.
              // If we pass param1=arcLen, param2=0, param3=0,
              // DubinsRenderer (LSL) draws:
              // 1. Arc(L, sum) ? No.
              // It draws Arc(param1) -> Line(param2) -> Arc(param3).
              // So Arc(arcLen) -> Line(0) -> Arc(0).
              // This effectively draws ONE arc of length arcLen!
              // Perfect.
            });
          }
        }
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
    chiral2: 'L' | 'R',
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

    // [FIX] Use analytically exact bitangents for unequal radii instead of fixed-radius sampler
    // This prevents the path from erroneously cutting through the disk interior when connecting 
    // disks of different sizes.
    // We import calculateBitangentPaths at top to use here
    const candidates = calculateBitangentPaths(
      { ...disk1.center, radius: disk1.visualRadius },
      { ...disk2.center, radius: disk2.visualRadius }
    );

    // Filter by Chirality
    // We check if the Dubins Path Type starts with chiral1 and ends with chiral2.
    const validCandidates = candidates.filter((p) => {
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
  public calculateFlexibleEnvelope(disks: CSDisk[], contacts: DiskContact[]): DubinsPath[] {
    const paths: DubinsPath[] = [];

    // Map disks by ID for easy efficient
    const diskMap = new Map<string, CSDisk>();
    disks.forEach((d) => diskMap.set(d.id, d));

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
        delta: Math.PI / 6,
      };

      const range2: AngularRange = {
        center: nominalAngle2,
        delta: Math.PI / 6,
      };

      // Construct Contact Configurations
      const startContact: ContactPointWithRange = {
        disk: { center: disk1.center, radius: disk1.visualRadius }, // Use visual radius
        range: range1,
      };

      const endContact: ContactPointWithRange = {
        disk: { center: disk2.center, radius: disk2.visualRadius },
        range: range2,
      };

      // Compute Paths
      const candidates = computeDubinsWithRanges(startContact, endContact, this.samplingConfig);

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
    nominalAngle1?: number,
  ): DubinsPath | null {
    // Vector from disk1 to disk2 if angle not provided
    let angle1 = nominalAngle1;
    if (angle1 === undefined) {
      angle1 = Math.atan2(disk2.center.y - disk1.center.y, disk2.center.x - disk1.center.x);
    }

    const angle2 = Math.atan2(disk1.center.y - disk2.center.y, disk1.center.x - disk2.center.x);

    const range1: AngularRange = { center: angle1, delta: Math.PI / 6 };
    const range2: AngularRange = { center: angle2, delta: Math.PI / 6 };

    const start: ContactPointWithRange = {
      disk: { center: disk1.center, radius: disk1.visualRadius },
      range: range1,
    };
    const end: ContactPointWithRange = {
      disk: { center: disk2.center, radius: disk2.visualRadius },
      range: range2,
    };

    const candidates = computeDubinsWithRanges(start, end, this.samplingConfig);
    return candidates.length > 0 ? candidates[0] : null;
  }
}
