/**
 * hull/ — Cascos convexos y distancias entre discos
 */
export { computeDiskHull, computeFromOrderedHull, computeHullLength, computeHullMetrics, hullSegmentsToSvgPath } from './diskHull';
export type { DiskHull, HullMetrics, HullSegment } from './diskHull';
export { computeRobustConvexHull } from './robustHull';
export { computeSequenceEnvelope } from './sequenceHull';
export * from './diskDistance';
export * from './resolveOverlaps';
