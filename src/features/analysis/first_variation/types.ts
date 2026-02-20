/**
 * CS Diagram Protocol Types
 * Based on "Instrucciones.pdf" - Section 1.2, 2.3
 */

/** A point in R^2 */
export type Point = {
  x: number;
  y: number;
};
export type Vector = Point;

/**
 * A Unit Disk.
 * Radius is fixed to R = 1 in this protocol.
 */
export type Disk = {
  /** Index k in {1, ..., N} (0-indexed in implementation: 0 to N-1) */
  index: number;
  center: Point;
};

/**
 * An unordered pair representing a contact between two disks.
 * Corresponds to set E in the PDF.
 */
export type Contact = {
  /** Index of disk i */
  diskA: number;
  /** Index of disk j */
  diskB: number;
};

/**
 * A tangency point where a curve meets a disk.
 * Corresponds to set T in the PDF.
 */
export type Tangency = {
  id: string; // Label alpha
  diskIndex: number; // k(alpha)
  point: Point; // p_alpha
};

/**
 * A straight line segment between two tangency points.
 * Corresponds to set S in the PDF.
 */
export type Segment = {
  startTangencyId: string; // alpha
  endTangencyId: string; // beta
};

/**
 * A circular arc on a disk boundary.
 * Corresponds to set A in the PDF.
 */
export type Arc = {
  startTangencyId: string; // alpha
  endTangencyId: string; // beta
  diskIndex: number; // k (must match k(alpha) and k(beta))
  deltaTheta: number; // Oriented angular increment (CCW) in (0, 2pi)
};

/**
 * Global configuration tolerances.
 * Section 2.2
 */
export type Tolerances = {
  met: number; // Metric tolerance (positions)
  geo: number; // Geometric tolerance (intersections, orthogonality)
  lin: number; // Linear tolerance (residuals, algebra)
};

/**
 * Complete CS Diagram Data
 */
export type CSDiagram = {
  disks: Disk[];
  contacts: Contact[];
  tangencies: Tangency[];
  segments: Segment[];
  arcs: Arc[];
  tolerances: Tolerances;
};
