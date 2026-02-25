/**
 * Mathematically Strict CS Diagram Protocol (csProtocol.ts)
 *
 * This formalizes the CS topological structure defined in "Instrucciones.pdf".
 * It serves as the static mathematical definition of the knot diagram, completely
 * decoupled from the dynamic drawing logic.
 */

import type { Point2D } from '../types/cs';

export interface CSTangency {
    id: string; // The label α
    diskId: string; // The disk k(α)
    point: Point2D; // The point p_α ∈ ∂D_k(α)
    normal: Point2D; // n_α := p_α - c_k (Length must be strictly 1)
    tangent: Point2D; // t_α := ε_α * J * n_α (Length must be strictly 1)
    epsilon: 1 | -1; // Orientation sign (ε_α)
}

export interface CSSegment {
    id: string; // The segment identifier s
    startTangencyId: string; // α
    endTangencyId: string; // β
}

export interface CSArc {
    id: string; // The arc identifier a
    startTangencyId: string; // α
    endTangencyId: string; // β
    diskId: string; // k
    sign: 1 | -1; // σ_a (+1 for CCW, -1 for CW)
    deltaTheta: number; // Δθ_a ∈ (0, 2π) increment
}

export interface CSContact {
    id: string;
    diskId1: string; // i
    diskId2: string; // j (Unordered pair {i, j})
}

export interface CSDiskMap {
    id: string;
    center: Point2D; // c_i
}

/**
 * The complete mathematical state of a CS Diagram.
 */
export interface CSDiagramState {
    disks: Map<string, CSDiskMap>; // c_1, ..., c_N
    contacts: CSContact[]; // $\cal{E}$ (Disk-disk contacts)
    tangencies: Map<string, CSTangency>; // $\cal{T}$ (Curve-disk tangencies)
    segments: CSSegment[]; // $\cal{S}$ (Straight segments)
    arcs: CSArc[]; // $\cal{A}$ (Circular arcs)
}
