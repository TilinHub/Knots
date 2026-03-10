import { Logger } from '../../../app/store/Logger';
import { intersectsDisk, intersectsSegment } from './collision';
import type { ContactDisk } from '../../types/contactGraph';
import type { Point2D } from '../../types/cs';
import { calculateAllBitangents } from '../primitives/bitangents';
export type TangentType = 'LSL' | 'RSR' | 'LSR' | 'RSL' | 'PTD-L' | 'PTD-R' | 'DTP-L' | 'DTP-R';

export interface TangentSegment {
  type: TangentType;
  start: Point2D;
  end: Point2D;
  length: number;
  startDiskId: string;
  endDiskId: string;
}

export interface BoundedCurvatureGraph {
  nodes: Map<string, ContactDisk>;
  edges: TangentSegment[]; // All valid spatial edges
}

/**
 * Calculates the 4 bitangent segments between two disks.
 * Does NOT check for collisions with other disks.
 */
export function calculateBitangents(d1: ContactDisk, d2: ContactDisk): TangentSegment[] {
  return calculateAllBitangents(d1, d2) as TangentSegment[];
}



/**
 * Builds the Bounded Curvature Graph mainly by computing all valid pairwise bitangents.
 */
export function buildBoundedCurvatureGraph(
  disks: ContactDisk[],
  checkCollisions: boolean = true,
  obstacleSegments: { p1: Point2D; p2: Point2D }[] = [],
  outerTangentsOnly: boolean = false,
): BoundedCurvatureGraph {
  Logger.debug('ContactGraph', 'Building Bounded Curvature Graph', {
    disksCount: disks.length,
    checkCollisions,
    outerTangentsOnly,
  });
  const validEdges: TangentSegment[] = [];

  for (let i = 0; i < disks.length; i++) {
    for (let j = i + 1; j < disks.length; j++) {
      const candidates = calculateBitangents(disks[i], disks[j]);
      const reverseCandidates = calculateBitangents(disks[j], disks[i]);

      let allCandidates = [...candidates, ...reverseCandidates];

      // Filter out inner tangents (LSR/RSL) for envelope mode.
      // Inner tangents cross between the two disks they connect,
      // creating self-intersecting "star" patterns in the envelope.
      if (outerTangentsOnly) {
        allCandidates = allCandidates.filter((s) => s.type === 'LSL' || s.type === 'RSR');
      }

      for (const seg of allCandidates) {
        // Check against ALL other disks only if checkCollisions is true
        let blocked = false;
        if (checkCollisions) {
          for (let k = 0; k < disks.length; k++) {
            if (k === i || k === j) continue;
            if (intersectsDisk(seg.start, seg.end, disks[k])) {
              blocked = true;
              break;
            }
          }

          // Check OBSTACLE SEGMENTS
          if (!blocked) {
            for (const obs of obstacleSegments) {
              if (intersectsSegment(seg.start, seg.end, obs.p1, obs.p2)) {
                blocked = true;
                break;
              }
            }
          }
        }
        if (!blocked) {
          validEdges.push(seg);
        }
      }

      // [FIX] Virtual Inner Tangents REMOVED.
      // Strict physics only.
    }
  }

  const nodeMap = new Map<string, ContactDisk>();
  disks.forEach((d) => nodeMap.set(d.id, d));

  Logger.debug('ContactGraph', 'Graph Built', { nodes: nodeMap.size, edges: validEdges.length });

  return {
    nodes: nodeMap,
    edges: validEdges,
  };
}

/**
 * Computes the optimal Bounded Curvature Envelope through a sequence of disks.
 * Enforces C1 continuity by matching Arrival Chirality with Departure Chirality.
 * Uses a Viterbi-like approach to find the shortest path of (L/R) states.
 */

export interface ArcSegment {
  type: 'ARC';
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
  chirality: 'L' | 'R'; // L=CCW, R=CW
  length: number;
  diskId: string;
}

export type EnvelopeSegment = TangentSegment | ArcSegment;







// ------------------------------------------------------------------
// CONTACT MATRIX / RIGIDITY ANALYSIS (Placeholder/Restored)
// ------------------------------------------------------------------

export interface ContactInfo {
  index1: number;
  index2: number;
  point: Point2D;
  normal: Point2D;
}

export function calculateJacobianMatrix(disks: ContactDisk[]): {
  matrix: number[][];
  contacts: ContactInfo[];
} {
  const contacts: ContactInfo[] = [];
  const n = disks.length;
  // Simple contact detection (brute force O(n^2))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d1 = disks[i];
      const d2 = disks[j];
      const dx = d2.center.x - d1.center.x;
      const dy = d2.center.y - d1.center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const rSum = d1.radius + d2.radius;

      // Tolerance for contact — proportional to sum of radii to work at any scale
      // (e.g. visualRadius=50 → tolerance=1.0; radius=1 → tolerance=0.02)
      const contactTolerance = rSum * 0.01;
      if (Math.abs(dist - rSum) < contactTolerance || dist < rSum) {
        // Overlap or touching
        // Determine contact point and normal
        const normal = { x: dx / dist, y: dy / dist };
        const point = {
          x: d1.center.x + normal.x * d1.radius,
          y: d1.center.y + normal.y * d1.radius,
        };
        contacts.push({ index1: i, index2: j, point, normal });
      }
    }
  }

  const numContacts = contacts.length;
  const numCoords = n * 2;
  // Initialize matrix
  const matrix: number[][] = [];
  for (let k = 0; k < numContacts; k++) {
    matrix[k] = new Array(numCoords).fill(0);
  }

  contacts.forEach((contact, rowIdx) => {
    const i = contact.index1;
    const j = contact.index2;
    const nx = contact.normal.x;
    const ny = contact.normal.y;

    // Row for contact (i, j):
    // (xi - xj)*nx + (yi - yj)*ny = 0 => linearized constraints
    // Col 2*i:     -nx
    // Col 2*i+1:   -ny
    // Col 2*j:      nx
    // Col 2*j+1:    ny

    matrix[rowIdx][2 * i] = -nx;
    matrix[rowIdx][2 * i + 1] = -ny;
    matrix[rowIdx][2 * j] = nx;
    matrix[rowIdx][2 * j + 1] = ny;
  });

  return { matrix, contacts };
}

// Temporary Re-exports to not break project immediately
export { intersectsDisk, intersectsSegment };
export { intersectsAnyDiskStrict } from './collision';
export * from '../../algorithms/envelopePath';
export * from '../../algorithms/pointPathSearch';
