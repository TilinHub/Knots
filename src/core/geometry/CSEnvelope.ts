/**
 * CSEnvelope — SDF + Marching Squares
 *
 * The envelope is the isocontour of the signed distance field:
 *   f(x,y) = min_i( ||(x,y) - center_i|| - radius_i )
 * at level f = d (positive offset).
 *
 * Algorithm:
 * 1. Evaluate SDF on a regular grid
 * 2. Extract isocontour via Marching Squares
 * 3. Trace connected contour chains
 * 4. Smooth with Chaikin subdivision
 *
 * Guarantees: curve never enters any disk, no self-intersections,
 * adapts continuously, no ordering dependency.
 */

import type { Point2D } from '../types/cs';

export interface Circle {
  center: Point2D;
  radius: number;
  id?: string;
}

// Marching Squares edge-pair table.
// Bits: 0=BL, 1=BR, 2=TR, 3=TL. Set if value < 0 (inside).
// Edges: 0=bottom, 1=right, 2=top, 3=left.
const MS: number[][][] = [
  [], [[3, 0]], [[0, 1]], [[3, 1]],
  [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
  [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[2, 1]],
  [[1, 3]], [[0, 1]], [[3, 0]], []
];

export class SmoothCSEnvelope {
  private circles: Circle[] = [];
  private envelopePoints: Point2D[] = [];
  private smoothness: number = 40;
  private bezierTension: number = 0.5;
  private adaptiveSmoothing: boolean = true;

  constructor(circles: Circle[] = []) {
    this.circles = circles;
    if (circles.length > 0) this.calculateEnvelope();
  }

  calculateEnvelope(): Point2D[] {
    const n = this.circles.length;
    if (n === 0) { this.envelopePoints = []; return []; }
    if (n === 1) {
      const c = this.circles[0];
      const d = this.offset();
      this.envelopePoints = this.ring(c.center, c.radius + d, 64);
      return this.envelopePoints;
    }

    // 1. Offset for connectivity
    const d = this.offset();

    // 2. Bounding box
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of this.circles) {
      x0 = Math.min(x0, c.center.x - c.radius);
      x1 = Math.max(x1, c.center.x + c.radius);
      y0 = Math.min(y0, c.center.y - c.radius);
      y1 = Math.max(y1, c.center.y + c.radius);
    }
    const pad = d + 1;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;

    // 3. Grid
    const RES = 120;
    const cs = Math.max((x1 - x0), (y1 - y0)) / RES;
    const nx = Math.ceil((x1 - x0) / cs) + 1;
    const ny = Math.ceil((y1 - y0) / cs) + 1;

    // 4. Evaluate SDF - d
    const g: Float64Array[] = [];
    for (let iy = 0; iy < ny; iy++) {
      g[iy] = new Float64Array(nx);
      for (let ix = 0; ix < nx; ix++) {
        const px = x0 + ix * cs, py = y0 + iy * cs;
        g[iy][ix] = this.sdf(px, py) - d;
      }
    }

    // 5. Marching Squares → adjacency
    const pts = new Map<string, Point2D>();
    const adj = new Map<string, string[]>();

    const addAdj = (a: string, b: string) => {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a)!.push(b);
      adj.get(b)!.push(a);
    };

    for (let iy = 0; iy < ny - 1; iy++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        const v0 = g[iy][ix], v1 = g[iy][ix + 1],
          v2 = g[iy + 1][ix + 1], v3 = g[iy + 1][ix];
        const ci = (v0 < 0 ? 1 : 0) | (v1 < 0 ? 2 : 0) | (v2 < 0 ? 4 : 0) | (v3 < 0 ? 8 : 0);

        // Asymptotic decider for ambiguous saddle-point cases 5 and 10.
        // vc = average of 4 corners = scalar value at cell center.
        // vc < 0  → inside-dominant: the two "inside" corners are connected
        //           through the center, so contour wraps around outside corners.
        // vc >= 0 → outside-dominant: inside corners are separated.
        let segs: number[][];
        if (ci === 5) {
          const vc = (v0 + v1 + v2 + v3) / 4;
          // Case 5 (0101): c0(BL) in, c2(TR) in, c1(BR) out, c3(TL) out
          segs = vc < 0
            ? [[0, 1], [2, 3]]   // inside connected → wrap BR and TL separately
            : [[3, 0], [1, 2]];  // inside separated → wrap BL and TR separately
        } else if (ci === 10) {
          const vc = (v0 + v1 + v2 + v3) / 4;
          // Case 10 (1010): c1(BR) in, c3(TL) in, c0(BL) out, c2(TR) out
          segs = vc < 0
            ? [[3, 0], [1, 2]]   // inside connected → wrap BL and TR separately
            : [[0, 1], [2, 3]];  // inside separated → wrap BR and TL separately
        } else {
          segs = MS[ci];
        }
        if (!segs.length) continue;

        for (const [ea, eb] of segs) {
          const ka = this.ekey(ix, iy, ea);
          const kb = this.ekey(ix, iy, eb);
          if (!pts.has(ka)) pts.set(ka, this.interp(ix, iy, ea, g, x0, y0, cs));
          if (!pts.has(kb)) pts.set(kb, this.interp(ix, iy, eb, g, x0, y0, cs));
          addAdj(ka, kb);
        }
      }
    }

    // 6. Trace largest contour
    const vis = new Set<string>();
    let best: Point2D[] = [];

    for (const k of pts.keys()) {
      if (vis.has(k)) continue;
      const chain: Point2D[] = [];
      let cur: string | undefined = k;
      while (cur && !vis.has(cur)) {
        vis.add(cur);
        chain.push(pts.get(cur)!);
        const nb = adj.get(cur);
        cur = nb?.find(x => !vis.has(x));
      }
      if (chain.length > best.length) best = chain;
    }

    // 7. Chaikin smooth (2 iterations)
    best = this.chaikin(best, 2);

    this.envelopePoints = best;
    return best;
  }

  // ── SDF ──────────────────────────────────────────────────────────
  private sdf(x: number, y: number): number {
    let m = Infinity;
    for (const c of this.circles) {
      const v = Math.hypot(x - c.center.x, y - c.center.y) - c.radius;
      if (v < m) m = v;
    }
    return m;
  }

  // ── Offset via MST max-gap ───────────────────────────────────────
  private offset(): number {
    const n = this.circles.length;
    if (n <= 1) return 0.1;
    // Kruskal MST
    type E = { i: number; j: number; g: number };
    const es: E[] = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dd = Math.hypot(
          this.circles[i].center.x - this.circles[j].center.x,
          this.circles[i].center.y - this.circles[j].center.y
        );
        es.push({ i, j, g: Math.max(0, dd - this.circles[i].radius - this.circles[j].radius) });
      }
    es.sort((a, b) => a.g - b.g);
    const par = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    let mx = 0, cnt = 0;
    for (const e of es) {
      const a = find(e.i), b = find(e.j);
      if (a !== b) { par[a] = b; mx = Math.max(mx, e.g); if (++cnt === n - 1) break; }
    }
    return mx / 2 + 0.15;
  }

  // ── Canonical edge key ───────────────────────────────────────────
  private ekey(ix: number, iy: number, e: number): string {
    // 0=bottom(h), 1=right(v), 2=top(h), 3=left(v)
    switch (e) {
      case 0: return `h${ix},${iy}`;
      case 1: return `v${ix + 1},${iy}`;
      case 2: return `h${ix},${iy + 1}`;
      default: return `v${ix},${iy}`;
    }
  }

  // ── Interpolate crossing on edge ─────────────────────────────────
  private interp(ix: number, iy: number, e: number,
    g: Float64Array[], x0: number, y0: number, cs: number): Point2D {
    let va: number, vb: number, ax: number, ay: number, bx: number, by: number;
    switch (e) {
      case 0: // bottom: BL→BR
        va = g[iy][ix]; vb = g[iy][ix + 1];
        ax = x0 + ix * cs; ay = y0 + iy * cs; bx = x0 + (ix + 1) * cs; by = ay; break;
      case 1: // right: BR→TR
        va = g[iy][ix + 1]; vb = g[iy + 1][ix + 1];
        ax = x0 + (ix + 1) * cs; ay = y0 + iy * cs; bx = ax; by = y0 + (iy + 1) * cs; break;
      case 2: // top: TL→TR
        va = g[iy + 1][ix]; vb = g[iy + 1][ix + 1];
        ax = x0 + ix * cs; ay = y0 + (iy + 1) * cs; bx = x0 + (ix + 1) * cs; by = ay; break;
      default: // left: BL→TL
        va = g[iy][ix]; vb = g[iy + 1][ix];
        ax = x0 + ix * cs; ay = y0 + iy * cs; bx = ax; by = y0 + (iy + 1) * cs; break;
    }
    const t = va / (va - vb);
    return { x: ax + t * (bx - ax), y: ay + t * (by - ay) };
  }

  // ── Chaikin subdivision ──────────────────────────────────────────
  private chaikin(p: Point2D[], iters: number): Point2D[] {
    let pts = p;
    for (let it = 0; it < iters; it++) {
      const nxt: Point2D[] = [];
      const len = pts.length;
      for (let i = 0; i < len; i++) {
        const a = pts[i], b = pts[(i + 1) % len];
        nxt.push({ x: .75 * a.x + .25 * b.x, y: .75 * a.y + .25 * b.y });
        nxt.push({ x: .25 * a.x + .75 * b.x, y: .25 * a.y + .75 * b.y });
      }
      pts = nxt;
    }
    return pts;
  }

  // ── Circle helper ────────────────────────────────────────────────
  private ring(c: Point2D, r: number, n: number): Point2D[] {
    const pts: Point2D[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * 2 * Math.PI;
      pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
    }
    return pts;
  }

  // ── API compat ───────────────────────────────────────────────────
  updateCircles(c: Circle[]) { this.circles = c; this.calculateEnvelope(); }
  updateCirclesImmediate(c: Circle[]) { this.circles = c; this.calculateEnvelope(); }
  setSmoothness(v: number) { this.smoothness = v; this.calculateEnvelope(); }
  setBezierTension(v: number) { this.bezierTension = v; this.calculateEnvelope(); }
  setAdaptiveSmoothing(v: boolean) { this.adaptiveSmoothing = v; this.calculateEnvelope(); }
  getEnvelopePoints() { return this.envelopePoints; }
  getCircleCount() { return this.circles.length; }
  isEmpty() { return this.envelopePoints.length === 0; }
  getCircles() { return [...this.circles]; }
}
