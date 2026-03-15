/**
 * Core Types for CS Diagram Analysis
 *
 * Based on "Instrucciones.pdf" Sections 1.2, 2.3.
 * These are the mathematical primitives for the contact-structure
 * diagram protocol used in ribbonlength analysis.
 */

/** A point in R^2. */
export type Point = {
  x: number;
  y: number;
};

/** Alias: vectors and points share the same representation. */
export type Vector = Point;

/**
 * A unit disk in a CS diagram.
 * Radius is fixed to R = 1 in the protocol.
 */
export type Disk = {
  /** Index k in {0, ..., N-1} */
  index: number;
  center: Point;
};

/**
 * An unordered contact pair between two disks.
 * Corresponds to set E in the protocol.
 */
export type Contact = {
  diskA: number;
  diskB: number;
};

/**
 * A tangency point where the curve meets a disk boundary.
 * Corresponds to set T in the protocol.
 */
export type Tangency = {
  id: string;
  diskIndex: number;
  point: Point;
};

/**
 * A straight line segment between two tangency points.
 * Corresponds to set S in the protocol.
 */
export type Segment = {
  startTangencyId: string;
  endTangencyId: string;
};

/**
 * A circular arc on a disk boundary.
 * Corresponds to set A in the protocol.
 */
export type Arc = {
  startTangencyId: string;
  endTangencyId: string;
  diskIndex: number;
  /** Oriented angular increment (CCW) in (0, 2pi) */
  deltaTheta: number;
};

/** Global configuration tolerances (Section 2.2). */
export type Tolerances = {
  /** Metric tolerance (positions) */
  met: number;
  /** Geometric tolerance (intersections, orthogonality) */
  geo: number;
  /** Linear tolerance (residuals, algebra) */
  lin: number;
};

/** Complete CS Diagram data bundle. */
export type CSDiagram = {
  disks: Disk[];
  contacts: Contact[];
  tangencies: Tangency[];
  segments: Segment[];
  arcs: Arc[];
  tolerances: Tolerances;
};
