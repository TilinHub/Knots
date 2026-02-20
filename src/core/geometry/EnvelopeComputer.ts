import type { CSDisk } from '../types/cs';
import type { EnvelopeSegment } from './contactGraph';

/**
 * Interface for computing the envelope of a set of disks.
 * This abstracts the specific algorithm used (e.g., "Original" vs "Robust Hull").
 */
export interface EnvelopeComputer {
  /**
   * compute
   * Calculates the envelope segments for the given disks.
   *
   * @param disks - The disks involved in the envelope.
   * @param modeContext - Optional context specific to the mode (e.g., knot sequence).
   * @returns An array of EnvelopeSegments representing the contour.
   */
  compute(disks: CSDisk[], modeContext?: any): EnvelopeSegment[];
}
