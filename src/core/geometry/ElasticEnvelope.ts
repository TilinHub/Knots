/**
 * ElasticEnvelope — Topology-first envelope representation.
 *
 * The envelope γ(s) is a closed curve composed of:
 *   • diskArc segments: arcs on disk boundaries
 *   • tangent segments: external bitangent lines between disks
 *
 * NO absolute coordinates are stored. Geometry is always reconstructed
 * from current disk positions + topological parameters.
 *
 * Invariants:
 *   I1. The curve is simple (no self-intersections)
 *   I2. The curve does not penetrate any disk interior
 *   I3. The cyclic contact order is stable under small perturbations
 *   I4. C1 continuity at arc/tangent junctions (tangent touches disk circle)
 */

import type { Point2D } from '../types/cs';
import { Logger } from '../utils/Logger';
import type { ArcSegment, EnvelopeSegment, TangentSegment, TangentType } from './contactGraph';

// ── Types ─────────────────────────────────────────────────────────

/** Arc segment on a disk surface */
export interface ElasticArcSegment {
  type: 'diskArc';
  diskId: string;
  startAngle: number; // Angle on disk circle (radians)
  endAngle: number; // Angle on disk circle (radians)
  chirality: 'L' | 'R'; // L=CCW traversal, R=CW traversal
}

/** External bitangent connecting two disks */
export interface ElasticTangentSegment {
  type: 'tangent';
  fromDiskId: string;
  toDiskId: string;
  tangentType: TangentType; // 'LSL' | 'RSR' | 'LSR' | 'RSL'
}

export type ElasticSegment = ElasticArcSegment | ElasticTangentSegment;

/** The full elastic envelope — cyclic list of segments + metadata */
export interface ElasticEnvelope {
  segments: ElasticSegment[];
  diskSequence: string[]; // Ordered unique disk IDs
  chiralities: ('L' | 'R')[]; // Per-disk wrapping chirality
}

/** Disk geometry needed for reconstruction */
export interface DiskGeometry {
  id: string;
  center: Point2D;
  radius: number;
}

/** Validation result */
export interface EnvelopeValidation {
  valid: boolean;
  errors: string[];
}

// ── Builder ───────────────────────────────────────────────────────

import { type ContactDisk } from '../types/contactGraph';
import { buildBoundedCurvatureGraph, findEnvelopePath } from './contactGraph';

// Known non-disk IDs produced by findEnvelopePathFromPoints
const SYNTHETIC_IDS = new Set(['point', 'start', 'end', '']);

/**
 * Builds an ElasticEnvelope purely from topology (disk sequence + chiralities).
 * This completely decouples the saved envelope from construction points/anchors.
 *
 * @param diskSequence Ordered list of disk IDs
 * @param chiralities List of chiralities ('L' or 'R') for each disk
 * @param contactDisks All available disks with their geometry
 */
export function buildEnvelopeFromTopology(
  diskSequence: string[],
  chiralities: ('L' | 'R')[],
  contactDisks: ContactDisk[],
): ElasticEnvelope | null {
  if (diskSequence.length < 2) return null;

  try {
    // 1. Build the graph from current disk geometry
    // We use strict=true (tangent lines must respect chirality)
    const graph = buildBoundedCurvatureGraph(contactDisks, true);

    // 2. Find the optimal geometric path based ONLY on topology
    // This solves for the shortest path connecting the disks with the given chiralities
    const result = findEnvelopePath(graph, diskSequence, chiralities);

    if (!result.path || result.path.length === 0) {
      Logger.warn('ElasticEnvelope', 'Failed to build topology-based path');
      return null;
    }

    // 3. Convert the clean path to ElasticEnvelope
    // The resulting path is guaranteed to have proper disk IDs and geometric types
    return buildElasticEnvelope(result.path, diskSequence, chiralities);
  } catch (e) {
    Logger.error('ElasticEnvelope', 'Error building from topology', e);
    return null;
  }
}

/**
 * Converts an existing EnvelopeSegment[] path + metadata into an ElasticEnvelope.
 * This is the "one-time" conversion at save time: construction hints determine
 * which branch of the geometric solution to use, then are discarded.
 *
 * Handles paths from both findEnvelopePath (proper disk IDs) and
 * findEnvelopePathFromPoints (may contain 'point'/'start'/'end' IDs).
 */
export function buildElasticEnvelope(
  path: EnvelopeSegment[],
  diskSequence: string[],
  chiralities: ('L' | 'R')[],
): ElasticEnvelope {
  if (path.length === 0 || diskSequence.length < 2) {
    Logger.warn('ElasticEnvelope', 'Cannot build from empty path');
    return { segments: [], diskSequence: [], chiralities: [] };
  }

  const diskIdSet = new Set(diskSequence);
  const segments: ElasticSegment[] = [];

  // Collect arcs first (these always have valid disk IDs)
  const arcList: { seg: ArcSegment; idx: number }[] = [];
  for (let i = 0; i < path.length; i++) {
    if (path[i].type === 'ARC') {
      arcList.push({ seg: path[i] as ArcSegment, idx: i });
    }
  }

  for (let i = 0; i < path.length; i++) {
    const seg = path[i];

    if (seg.type === 'ARC') {
      const arcSeg = seg as ArcSegment;
      // Only include arcs that reference real disks in the sequence
      if (diskIdSet.has(arcSeg.diskId)) {
        segments.push({
          type: 'diskArc',
          diskId: arcSeg.diskId,
          startAngle: arcSeg.startAngle,
          endAngle: arcSeg.endAngle,
          chirality: arcSeg.chirality,
        });
      }
    } else {
      // TangentSegment
      const tanSeg = seg as TangentSegment;
      const fromId = tanSeg.startDiskId;
      const toId = tanSeg.endDiskId;

      // Case 1: Both IDs are real disks — direct conversion
      if (diskIdSet.has(fromId) && diskIdSet.has(toId)) {
        segments.push({
          type: 'tangent',
          fromDiskId: fromId,
          toDiskId: toId,
          tangentType: tanSeg.type,
        });
      }
      // Case 2: Synthetic IDs (from anchor-based path) — infer disk-to-disk tangent
      // Find the adjacent arcs to determine which disks this tangent connects
      else if (SYNTHETIC_IDS.has(fromId) || SYNTHETIC_IDS.has(toId)) {
        // Look for the nearest arc before and after this tangent
        const prevArc = findNearestArc(path, i, -1, diskIdSet);
        const nextArc = findNearestArc(path, i, +1, diskIdSet);

        if (prevArc && nextArc && prevArc.diskId !== nextArc.diskId) {
          // Infer tangent type from adjacent arc chiralities
          const tangentType = inferTangentType(prevArc.chirality, nextArc.chirality);
          segments.push({
            type: 'tangent',
            fromDiskId: prevArc.diskId,
            toDiskId: nextArc.diskId,
            tangentType,
          });
        }
        // If both arcs refer to the same disk or missing, skip this tangent
      }
      // else: mixed case, skip
    }
  }

  Logger.debug('ElasticEnvelope', 'Built', {
    inputSegments: path.length,
    elasticSegments: segments.length,
    disks: diskSequence.length,
  });

  return {
    segments,
    diskSequence: [...diskSequence],
    chiralities: [...chiralities],
  };
}

/** Find the nearest ARC segment in direction dir (-1 = backward, +1 = forward) */
function findNearestArc(
  path: EnvelopeSegment[],
  startIdx: number,
  dir: -1 | 1,
  diskIdSet: Set<string>,
): ArcSegment | null {
  for (let step = 1; step < path.length; step++) {
    const idx = (startIdx + step * dir + path.length) % path.length;
    const seg = path[idx];
    if (seg.type === 'ARC' && diskIdSet.has((seg as ArcSegment).diskId)) {
      return seg as ArcSegment;
    }
  }
  return null;
}

/** Infer tangent type from departure and arrival chiralities */
function inferTangentType(depChirality: 'L' | 'R', arrChirality: 'L' | 'R'): TangentType {
  // Departure chirality = how the curve leaves the first disk
  // Arrival chirality = how the curve enters the second disk
  if (depChirality === 'L' && arrChirality === 'L') return 'LSL';
  if (depChirality === 'R' && arrChirality === 'R') return 'RSR';
  if (depChirality === 'L' && arrChirality === 'R') return 'LSR';
  return 'RSL'; // R, L
}

// ── Geometry Reconstruction ───────────────────────────────────────

/**
 * Recomputes absolute geometry from topology + current disk positions.
 *
 * For each tangent segment: recomputes the bitangent of the specified type
 * between the two disks at their CURRENT positions.
 *
 * For each arc segment: uses angular parameters to compute points on
 * the disk circle at its CURRENT position.
 *
 * After computing tangent endpoints, ajusts adjacent arc startAngle/endAngle
 * to match the tangent touch points — this is the "elastic sliding".
 *
 * Returns EnvelopeSegment[] (compatible with existing renderer).
 */
export function reconstructGeometry(
  envelope: ElasticEnvelope,
  disks: Map<string, DiskGeometry>,
): EnvelopeSegment[] {
  if (envelope.segments.length === 0) return [];

  // First pass: compute tangent endpoints and arc geometry
  const resolved: EnvelopeSegment[] = [];

  for (let i = 0; i < envelope.segments.length; i++) {
    const seg = envelope.segments[i];

    if (seg.type === 'tangent') {
      const fromDisk = disks.get(seg.fromDiskId);
      const toDisk = disks.get(seg.toDiskId);

      if (!fromDisk || !toDisk) {
        Logger.warn('ElasticEnvelope', 'Missing disk for tangent', {
          from: seg.fromDiskId,
          to: seg.toDiskId,
        });
        continue;
      }

      const tangent = computeBitangent(fromDisk, toDisk, seg.tangentType);
      if (!tangent) {
        Logger.warn('ElasticEnvelope', 'Bitangent computation failed', {
          type: seg.tangentType,
        });
        continue;
      }

      resolved.push(tangent);
    } else {
      // diskArc — resolve from disk position
      const disk = disks.get(seg.diskId);
      if (!disk) {
        Logger.warn('ElasticEnvelope', 'Missing disk for arc', { diskId: seg.diskId });
        continue;
      }

      resolved.push({
        type: 'ARC',
        center: disk.center,
        radius: disk.radius,
        startAngle: seg.startAngle,
        endAngle: seg.endAngle,
        chirality: seg.chirality,
        length: calcArcLength(disk.radius, seg.startAngle, seg.endAngle, seg.chirality),
        diskId: seg.diskId,
      });
    }
  }

  // Second pass: update arc angles to match adjacent tangent endpoints.
  // This is the "elastic sliding" — arcs adapt to where tangents touch the disk.
  for (let i = 0; i < resolved.length; i++) {
    const seg = resolved[i];
    if (seg.type !== 'ARC') continue;

    const arcSeg = seg as ArcSegment;
    const disk = disks.get(arcSeg.diskId);
    if (!disk) continue;

    // Find the preceding tangent (its endpoint should be arc's start)
    const prevIdx = (i - 1 + resolved.length) % resolved.length;
    const prevSeg = resolved[prevIdx];
    if (prevSeg && prevSeg.type !== 'ARC') {
      const endPt = (prevSeg as TangentSegment).end;
      arcSeg.startAngle = Math.atan2(endPt.y - disk.center.y, endPt.x - disk.center.x);
    }

    // Find the following tangent (its start should be arc's end)
    const nextIdx = (i + 1) % resolved.length;
    const nextSeg = resolved[nextIdx];
    if (nextSeg && nextSeg.type !== 'ARC') {
      const startPt = (nextSeg as TangentSegment).start;
      arcSeg.endAngle = Math.atan2(startPt.y - disk.center.y, startPt.x - disk.center.x);
    }

    // Recompute arc length with updated angles
    arcSeg.length = calcArcLength(
      disk.radius,
      arcSeg.startAngle,
      arcSeg.endAngle,
      arcSeg.chirality,
    );
  }

  return resolved;
}

// ── Bitangent Computation ─────────────────────────────────────────

/**
 * Computes a specific bitangent between two disks.
 * Replicates the math from contactGraph.calculateBitangents but for a single type.
 */
function computeBitangent(
  d1: DiskGeometry,
  d2: DiskGeometry,
  tangentType: TangentType,
): TangentSegment | null {
  const dx = d2.center.x - d1.center.x;
  const dy = d2.center.y - d1.center.y;
  const D = Math.sqrt(dx * dx + dy * dy);
  const phi = Math.atan2(dy, dx);

  if (D < 1e-9) return null; // Coincident centers

  const pOnC = (c: Point2D, r: number, angle: number): Point2D => ({
    x: c.x + r * Math.cos(angle),
    y: c.y + r * Math.sin(angle),
  });

  const EPSILON = 1e-4;

  if (tangentType === 'LSL' || tangentType === 'RSR') {
    // Outer tangents
    if (D < Math.abs(d1.radius - d2.radius) - EPSILON) return null;

    const val = (d1.radius - d2.radius) / D;
    const gamma = Math.acos(Math.max(-1, Math.min(1, val)));
    if (isNaN(gamma)) return null;

    const alpha = tangentType === 'RSR' ? phi + gamma : phi - gamma;
    const p1 = pOnC(d1.center, d1.radius, alpha);
    const p2 = pOnC(d2.center, d2.radius, alpha);

    return {
      type: tangentType,
      start: p1,
      end: p2,
      length: Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2),
      startDiskId: d1.id,
      endDiskId: d2.id,
    };
  } else {
    // Inner tangents (LSR, RSL)
    if (D < 1e-9) return null; // Coincident centers

    const val = (d1.radius + d2.radius) / D;
    const beta = Math.acos(Math.max(-1, Math.min(1, val))); // Safe acos even if overlapping
    if (isNaN(beta)) return null;

    let alpha1: number, alpha2: number;
    if (tangentType === 'LSR') {
      alpha1 = phi - beta;
      alpha2 = phi - beta + Math.PI;
    } else {
      // RSL
      alpha1 = phi + beta;
      alpha2 = phi + beta + Math.PI;
    }

    const p1 = pOnC(d1.center, d1.radius, alpha1);
    const p2 = pOnC(d2.center, d2.radius, alpha2);

    return {
      type: tangentType,
      start: p1,
      end: p2,
      length: Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2),
      startDiskId: d1.id,
      endDiskId: d2.id,
    };
  }
}

// ── Arc Length Helper ──────────────────────────────────────────────

function calcArcLength(
  radius: number,
  startAngle: number,
  endAngle: number,
  chirality: 'L' | 'R',
): number {
  const PI2 = 2 * Math.PI;
  let delta = endAngle - startAngle;

  // Normalize to (-PI, PI]
  while (delta <= -Math.PI) delta += PI2;
  while (delta > Math.PI) delta -= PI2;

  if (chirality === 'L') {
    // CCW: positive delta
    if (delta <= 0) delta += PI2;
  } else {
    // CW: negative delta → take absolute
    if (delta >= 0) delta -= PI2;
    delta = Math.abs(delta);
  }

  return delta * radius;
}

// ── Validation ────────────────────────────────────────────────────

/**
 * Validates geometric invariants of the envelope.
 *
 * Checks:
 *   1. All referenced disks exist
 *   2. Arc angles are valid (startAngle ≠ endAngle)
 *   3. Tangent segments don't penetrate non-associated disks
 *   4. Segments form a consistent cyclic chain
 */
export function validateEnvelope(
  envelope: ElasticEnvelope,
  disks: Map<string, DiskGeometry>,
): EnvelopeValidation {
  const errors: string[] = [];

  if (envelope.segments.length === 0) {
    return { valid: true, errors: [] };
  }

  // Check 1: All referenced disks exist
  for (const seg of envelope.segments) {
    if (seg.type === 'diskArc') {
      if (!disks.has(seg.diskId)) {
        errors.push(`Arc references missing disk: ${seg.diskId}`);
      }
    } else {
      if (!disks.has(seg.fromDiskId)) {
        errors.push(`Tangent references missing fromDisk: ${seg.fromDiskId}`);
      }
      if (!disks.has(seg.toDiskId)) {
        errors.push(`Tangent references missing toDisk: ${seg.toDiskId}`);
      }
    }
  }

  // Check 2: Arc angles are valid (allow full 2pi circles which have identical start/end angles)
  for (const seg of envelope.segments) {
    if (seg.type === 'diskArc') {
      const disk = disks.get(seg.diskId);
      if (disk) {
        const len = calcArcLength(disk.radius, seg.startAngle, seg.endAngle, seg.chirality);
        if (len < 1e-4) {
          errors.push(`Zero-length arc on disk ${seg.diskId}`);
        }
      }
    }
  }

  // Check 3: Chain consistency — tangent→arc→tangent→arc...
  // Each tangent's toDiskId should match the next segment's diskId (if arc)
  // or the next tangent's fromDiskId.
  for (let i = 0; i < envelope.segments.length; i++) {
    const curr = envelope.segments[i];
    const next = envelope.segments[(i + 1) % envelope.segments.length];

    if (curr.type === 'tangent' && next.type === 'diskArc') {
      if (curr.toDiskId !== next.diskId) {
        errors.push(
          `Chain break at segment ${i}: tangent→${curr.toDiskId} but arc on ${next.diskId}`,
        );
      }
    } else if (curr.type === 'diskArc' && next.type === 'tangent') {
      if (curr.diskId !== next.fromDiskId) {
        errors.push(
          `Chain break at segment ${i}: arc on ${curr.diskId} but tangent from ${next.fromDiskId}`,
        );
      }
    }
  }

  // Check 4: Tangent disk penetration (only if all disks exist)
  if (errors.length === 0) {
    const geometry = reconstructGeometry(envelope, disks);
    for (const seg of geometry) {
      if (seg.type !== 'ARC') {
        const tanSeg = seg as TangentSegment;
        for (const [diskId, disk] of disks) {
          if (diskId === tanSeg.startDiskId || diskId === tanSeg.endDiskId) continue;
          if (segmentPenetratesDisk(tanSeg.start, tanSeg.end, disk)) {
            errors.push(
              `Tangent ${tanSeg.startDiskId}→${tanSeg.endDiskId} penetrates disk ${diskId}`,
            );
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    Logger.warn('ElasticEnvelope', 'Validation failed', { errors });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Checks if a line segment penetrates a disk interior.
 * Returns true if minimum distance from segment to center < radius.
 */
function segmentPenetratesDisk(p1: Point2D, p2: Point2D, disk: DiskGeometry): boolean {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len2 = dx * dx + dy * dy;

  if (len2 < 1e-12) {
    // Degenerate segment (point)
    const d = Math.sqrt((p1.x - disk.center.x) ** 2 + (p1.y - disk.center.y) ** 2);
    return d < disk.radius - 1e-4;
  }

  // Project disk center onto segment
  const t = Math.max(
    0,
    Math.min(1, ((disk.center.x - p1.x) * dx + (disk.center.y - p1.y) * dy) / len2),
  );

  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;
  const dist = Math.sqrt((projX - disk.center.x) ** 2 + (projY - disk.center.y) ** 2);

  // Strict interior with tolerance
  // [FIX] Relax tolerance slightly to avoid false positives on grazing tangents or reconstructed bitangents.
  // The tangent connects two disk boundaries exactly, so it might pass within r - 1e-12 of an intermediate disk boundary due to float errors.
  return dist < disk.radius - 1e-3;
}
