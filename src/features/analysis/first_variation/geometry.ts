import { Logger } from '../../../core/utils/Logger';
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
export function calculateDeltaTheta(pAlpha: Point, pBeta: Point, center: Point): number {
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

/**
 * G2/G3 Intersection Checks Utilities
 */

/**
 * Checks if angle theta is within the CCW interval [start, end].
 * Handles modular arithmetic for circular ranges.
 */
export function isAngleInInterval(
  theta: number,
  start: number,
  end: number,
  tolerance: number = 1e-9,
): boolean {
  const twoPi = 2 * Math.PI;
  const s = wrap0_2pi(start);
  let e = wrap0_2pi(end);
  let t = wrap0_2pi(theta);

  // Normalize to start = 0
  e = wrap0_2pi(e - s);
  t = wrap0_2pi(t - s);

  // After rotation, interval is [0, e].
  // If e is very close to 0 (full circle or empty?), we assume oriented arcs always have length > 0.
  // However, our arcs are typically small. If e approx 0, it might be a full circle if logic allows,
  // but in this context arcs are parts of the boundary.

  // Check if t is in [-tol, e + tol]
  // Since we wrapped, t is in [0, 2pi).

  // Case: t slightly less than 0 (which becomes ~2pi)
  if (t > twoPi - tolerance) t = 0;

  return t >= -tolerance && t <= e + tolerance;
}

/**
 * G2: Segment-Arc Intersection
 * Segment: A to B
 * Arc: Center C, Radius R, Angle interval [theta1, theta2] (CCW)
 */
export function intersectSegmentArc(
  pA: Point,
  pB: Point,
  C: Point,
  R: number,
  thetaStart: number,
  thetaEnd: number,
  tolerance: number = 1e-7,
): boolean {
  // 1. Line-Circle Intersection
  const d = sub(pB, pA);
  const f = sub(pA, C);

  // Quadratic equation for t: |P(t) - C|^2 = R^2
  // |(A + td) - C|^2 = |f + td|^2 = R^2
  // |f|^2 + 2(f.d)t + |d|^2 t^2 = R^2
  // a t^2 + b t + c = 0
  const a = dot(d, d);
  const b = 2 * dot(f, d);
  const c = dot(f, f) - R * R;

  let discriminator = b * b - 4 * a * c;
  if (discriminator < 0) return false; // No intersection with circle

  discriminator = Math.sqrt(discriminator);
  const t1 = (-b - discriminator) / (2 * a);
  const t2 = (-b + discriminator) / (2 * a);

  const checkIntersection = (t: number): boolean => {
    // Must be within segment (0, 1) exclusive of endpoints (topology connections are valid)
    if (t <= tolerance || t >= 1 - tolerance) return false;

    // Intersection Point
    const P = add(pA, scale(d, t));

    // Check angle on arc
    const theta = Math.atan2(P.y - C.y, P.x - C.x);
    return isAngleInInterval(theta, thetaStart, thetaEnd, tolerance);
  };

  const hasIntersection = checkIntersection(t1) || checkIntersection(t2);
  if (hasIntersection) {
    Logger.warn('Geometry', 'G2 Intersection Detected', { pA, pB, C, R, thetaStart, thetaEnd });
  }
  return hasIntersection;
}

/**
 * G3: Arc-Arc Intersection
 * Arc 1: C1, R1, [th1_s, th1_e]
 * Arc 2: C2, R2, [th2_s, th2_e]
 */
export function intersectArcArc(
  C1: Point,
  R1: number,
  th1_s: number,
  th1_e: number,
  C2: Point,
  R2: number,
  th2_s: number,
  th2_e: number,
  tolerance: number = 1e-7,
): boolean {
  const dVec = sub(C2, C1);
  const d2 = dot(dVec, dVec);
  const d = Math.sqrt(d2);

  // Case 0: Concentric
  if (d < tolerance) {
    // If radii are different, no intersection
    if (Math.abs(R1 - R2) > tolerance) return false;

    // Same circle: Check interval overlap
    // Strict overlap: check if any endpoint of one arc is STRICTLY inside the other
    // effectively shrinking the target interval by tolerance

    // Helper to check strict interior
    const strictInterval = (t: number, s: number, e: number) => {
      // shift t relative to s
      const t_rel = wrap0_2pi(t - s);
      const e_rel = wrap0_2pi(e - s);
      return t_rel > tolerance && t_rel < e_rel - tolerance;
    };

    // 1. Check endpoints of Arc1 inside Arc2
    if (strictInterval(th1_s, th2_s, th2_e)) {
      Logger.warn('Geometry', 'G3 Concentric Intersection (Arc1 inside Arc2)');
      return true;
    }
    if (strictInterval(th1_e, th2_s, th2_e)) {
      Logger.warn('Geometry', 'G3 Concentric Intersection (Arc1 inside Arc2)');
      return true;
    }

    // 2. Check endpoints of Arc2 inside Arc1 (covers containment)
    if (strictInterval(th2_s, th1_s, th1_e)) {
      Logger.warn('Geometry', 'G3 Concentric Intersection (Arc2 inside Arc1)');
      return true;
    }
    if (strictInterval(th2_e, th1_s, th1_e)) {
      Logger.warn('Geometry', 'G3 Concentric Intersection (Arc2 inside Arc1)');
      return true;
    }

    // 3. Identical case (endpoints match)
    // If s1~s2 and e1~e2, they overlap.
    // If s1~e2, they touch (valid).
    const d_s1s2 = Math.min(Math.abs(wrap0_2pi(th1_s - th2_s)), Math.abs(wrap0_2pi(th2_s - th1_s)));
    const d_e1e2 = Math.min(Math.abs(wrap0_2pi(th1_e - th2_e)), Math.abs(wrap0_2pi(th2_e - th1_e)));

    if (d_s1s2 < tolerance && d_e1e2 < tolerance) {
      Logger.warn('Geometry', 'G3 Concentric Identity Intersection');
      return true; // Identical
    }

    // If one contains the other strictly, endpoints check covers it.
    // If they just touch (s1~e2), strictInterval returns false.

    return false;
  }

  // Case 1: Separate circles
  if (d > R1 + R2 || d < Math.abs(R1 - R2)) return false;

  // Intersection points of two circles
  const a = (R1 * R1 - R2 * R2 + d2) / (2 * d);
  const h = Math.sqrt(Math.max(0, R1 * R1 - a * a));

  const x2 = C1.x + (a * (C2.x - C1.x)) / d;
  const y2 = C1.y + (a * (C2.y - C1.y)) / d;

  // Two points
  const P1 = {
    x: x2 + (h * (C2.y - C1.y)) / d,
    y: y2 - (h * (C2.x - C1.x)) / d,
  };
  const P2 = {
    x: x2 - (h * (C2.y - C1.y)) / d,
    y: y2 + (h * (C2.x - C1.x)) / d,
  };

  const checkPoint = (P: Point): boolean => {
    const theta1 = Math.atan2(P.y - C1.y, P.x - C1.x);
    const theta2 = Math.atan2(P.y - C2.y, P.x - C2.x);

    // Must be STRICTLY INTERIOR to both arcs to count as invalid intersection
    // "Touching" at endpoints is allowed (it's a connection or tangency)
    // So we use strict interval check

    const strictInterval = (t: number, s: number, e: number) => {
      const t_rel = wrap0_2pi(t - s);
      const e_rel = wrap0_2pi(e - s);
      return t_rel > tolerance && t_rel < e_rel - tolerance;
    };

    const inArc1 = strictInterval(theta1, th1_s, th1_e);
    const inArc2 = strictInterval(theta2, th2_s, th2_e);

    return inArc1 && inArc2;
  };

  if (checkPoint(P1)) {
    Logger.warn('Geometry', 'G3 Intersection at P1', { P1, C1, C2 });
    return true;
  }
  if (dist(P1, P2) > tolerance && checkPoint(P2)) {
    Logger.warn('Geometry', 'G3 Intersection at P2', { P2, C1, C2 });
    return true;
  }

  return false;
}

/**
 * G1: Segment-Segment Proper Intersection
 * Returns true only if segments intersect at a point INTERIOR to both.
 * Shares endpoints are NOT intersections.
 */
export function intersectSegmentSegment(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
  tolerance: number = 1e-9,
): boolean {
  const cross = (v: Vector, w: Vector) => v.x * w.y - v.y * w.x;

  const p = a;
  const r = sub(b, a);
  const q = c;
  const s = sub(d, c);

  const rxs = cross(r, s);
  const qpxr = cross(sub(q, p), r);

  // Collinear
  if (Math.abs(rxs) < tolerance && Math.abs(qpxr) < tolerance) {
    // Check overlap logic if needed, but for "Proper" intersection in knots, collinear overlapping is bad.
    // Assuming general position or strict checks:
    // Project to 1D and check overlap excluding endpoints?
    // Simplification: Collinear adjacent segments are fine. Collinear overlapping is G1 fail.
    // Let's be strict: if collinear and overlapping strict interiors -> Fail.

    // 1D project
    const rr = dot(r, r);
    const t0 = dot(sub(q, p), r) / rr;
    const t1 = dot(sub(d, p), r) / rr;

    const tMin = Math.min(t0, t1);
    const tMax = Math.max(t0, t1);

    // Check if (tMin, tMax) overlaps (0, 1) strictly
    if (tMax <= tolerance || tMin >= 1 - tolerance) return false;

    Logger.warn('Geometry', 'G1 Collinear Intersection', { a, b, c, d });
    return true;
  }

  if (Math.abs(rxs) < tolerance) return false; // Parallel non-collinear

  const t = cross(sub(q, p), s) / rxs;
  const u = cross(sub(q, p), r) / rxs;

  // Strict interior intersection: 0 < t < 1 and 0 < u < 1
  const intersects = t > tolerance && t < 1 - tolerance && u > tolerance && u < 1 - tolerance;

  if (intersects) {
    Logger.warn('Geometry', 'G1 Intersection', { t, u, a, b, c, d });
  }
  return intersects;
}
