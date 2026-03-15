/**
 * Ribbonlength Computation
 *
 * Based on the ribbon-knot model from Ayala-Kirszenblat-Rubinstein
 * (arXiv 2005.13168v1).
 *
 * Ribbonlength is the fundamental measure of how efficiently a knot
 * can be tied with a flat ribbon of fixed width.  Formally:
 *
 *   Rib(K) = L(K) / w
 *
 * where L(K) is the total arc-length of the knot's center-curve and
 * w is the ribbon width.
 *
 * The separation bound requires that disk centers in a valid ribbon
 * configuration are separated by at least 2R (where R is the disk
 * radius), ensuring the ribbon does not self-overlap.
 */

import type { EnvelopeSegment } from '../geometry/envelope/contactGraph';

/** A disk in a ribbon-knot configuration. */
export interface RibbonDisk {
  center: { x: number; y: number };
  radius: number;
}

// ----------------------------------------------------------------
// Ribbonlength
// ----------------------------------------------------------------

/**
 * Computes the total arc-length of a piecewise path.
 * Accepts the project's native EnvelopeSegment[] type.
 *
 * For tangent segments: Euclidean distance between start and end.
 * For arcs: |sweep| × radius, where sweep = endAngle − startAngle
 * adjusted for chirality.
 */
export function computePathLength(path: EnvelopeSegment[]): number {
  let total = 0;

  for (const seg of path) {
    if (seg.type === 'ARC') {
      // Arc length from the stored length field (already computed)
      total += seg.length;
    } else {
      // Tangent segment
      total += seg.length;
    }
  }

  return total;
}

/**
 * Computes ribbonlength = total path length / ribbon width.
 *
 * @param path   The envelope path segments composing the knot curve.
 * @param ribbonWidth  The width of the ribbon (w > 0).
 * @returns The ribbonlength ratio.
 */
export function computeRibbonlength(
  path: EnvelopeSegment[],
  ribbonWidth: number,
): number {
  if (ribbonWidth <= 0) {
    throw new Error('Ribbon width must be positive');
  }
  return computePathLength(path) / ribbonWidth;
}

// ----------------------------------------------------------------
// Separation bound
// ----------------------------------------------------------------

/**
 * Checks the separation bound from the paper: for a valid ribbon-knot
 * configuration with N disks of radius R, the center-to-center
 * distance between any two distinct disks must be at least 2R.
 *
 * This is a necessary condition to avoid self-overlap of the ribbon.
 *
 * @returns An object with:
 *   - valid: true if all pairs satisfy the bound
 *   - minSeparation: the smallest center-to-center distance found
 *   - requiredSeparation: the required minimum (2R for the smallest R pair)
 */
export function checkSeparationBound(
  disks: RibbonDisk[],
): { valid: boolean; minSeparation: number; requiredSeparation: number } {
  const n = disks.length;

  if (n < 2) {
    return { valid: true, minSeparation: Infinity, requiredSeparation: 0 };
  }

  let minSep = Infinity;
  let minRequired = Infinity;
  let valid = true;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d1 = disks[i];
      const d2 = disks[j];
      const dx = d2.center.x - d1.center.x;
      const dy = d2.center.y - d1.center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Required separation is the sum of radii (= 2R for equal radii)
      const required = d1.radius + d2.radius;

      if (dist < minSep) {
        minSep = dist;
      }
      if (required < minRequired) {
        minRequired = required;
      }

      if (dist < required - 1e-9) {
        valid = false;
      }
    }
  }

  return {
    valid,
    minSeparation: minSep,
    requiredSeparation: minRequired,
  };
}
