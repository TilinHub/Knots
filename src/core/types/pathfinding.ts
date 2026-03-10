import type { BoundedCurvatureGraph, EnvelopeSegment } from '../geometry/envelope/contactGraph';

/** Node in the Dijkstra search graph for bounded curvature paths */
export interface SearchNode {
    id: string;
    cost: number;
    path: EnvelopeSegment[];
    angle: number;
    diskId?: string;
}

/** Candidate path with total length for comparison */
export interface PathCandidate {
    path: EnvelopeSegment[];
    length: number;
}
