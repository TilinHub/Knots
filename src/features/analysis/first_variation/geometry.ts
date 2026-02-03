/**
 * Geometric Utilities for CS Diagram Protocol
 */

import type { Point, Vector } from './types';

// See PDF Section 1.2 "Convencion de rotacion 90"
// J(x, y) = (-y, x)

export function add(a: Point, b: Point): Point {
    return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Point, b: Point): Vector {
    return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vector, s: number): Vector {
    return { x: v.x * s, y: v.y * s };
}

export function dot(a: Vector, b: Vector): number {
    return a.x * b.x + a.y * b.y;
}

export function normSq(v: Vector): number {
    return v.x * v.x + v.y * v.y;
}

export function norm(v: Vector): number {
    return Math.sqrt(normSq(v));
}

export function dist(a: Point, b: Point): number {
    return norm(sub(a, b));
}

/**
 * J rotation: 90 degrees CCW
 * J(x, y) = (-y, x)
 */
export function J(v: Vector): Vector {
    return { x: -v.y, y: v.x };
}

/**
 * Wraps angle to [0, 2pi)
 * Section 2.4: wrap[0, 2pi)(x)
 */
export function wrap0_2pi(angle: number): number {
    const twoPi = 2 * Math.PI;
    return ((angle % twoPi) + twoPi) % twoPi;
}

/**
 * Calculates oriented angular increment from alpha to beta on a disk.
 * Section 2.4 "Regla computable para Delta theta"
 */
export function calculateDeltaTheta(
    pAlpha: Point,
    pBeta: Point,
    center: Point
): number {
    const thetaAlpha = Math.atan2(pAlpha.y - center.y, pAlpha.x - center.x);
    const thetaBeta = Math.atan2(pBeta.y - center.y, pBeta.x - center.x);

    // DeltaTheta := wrap(thetaBeta - thetaAlpha)
    return wrap0_2pi(thetaBeta - thetaAlpha);
}

/**
 * Normal vector at tangency p on disk center c.
 * n_alpha := p_alpha - c_k
 */
export function calculateNormal(p: Point, c: Point): Vector {
    return sub(p, c);
}

/**
 * Tangent vector for outgoing piece.
 * For Arcs (CCW): t_alpha := J n_alpha (Section 2.4 Caso 2)
 * For Segments: t_alpha := (p_beta - p_alpha) normalized (Section 2.4 Caso 1 - check logic in checks.ts)
 */
export function calculateArcTangent(n: Vector): Vector {
    return J(n);
}

export function normalize(v: Vector): Vector {
    const n = norm(v);
    if (n === 0) return { x: 0, y: 0 }; // Should not happen in valid diagrams
    return scale(v, 1 / n);
}
