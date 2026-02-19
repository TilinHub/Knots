import type { Graph } from "../../io/parseGraph6";
import type { Point, Primitive, Scene, Segment } from "../model/entities";
import { createInitialScene } from "../model/scene";

type Vec2 = { x: number; y: number };

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashEdges(edges: Array<[number, number]>): number {
  let h = 2166136261;
  for (const [a, b] of edges) {
    h ^= a + 0x9e3779b9 + (h << 6) + (h >> 2);
    h ^= b + 0x9e3779b9 + (h << 6) + (h >> 2);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function segId(a: string, b: string) {
  return a < b ? `s-${a}-${b}` : `s-${b}-${a}`;
}

export type LayoutParams = {
  iterations?: number;
  edgeK?: number;    // fuerza de “resorte” para contactos
  repelK?: number;   // empuje anti-solapamiento para no-aristas
  jitter?: number;   // ruido inicial
  seed?: number;     // Semilla manual para random
  attempts?: number; // Intentos (multi-start) para evitar máximos locales
};

export function graphToContactScene(
  graph: Graph,
  radius: number,
  params: LayoutParams = {}
): Scene {
  const base = createInitialScene();

  const n = graph.nodes.length;
  const target = 2 * radius;

  const iterations = params.iterations ?? 5000;
  const edgeK = params.edgeK ?? 0.1;
  const repelK = params.repelK ?? 1.0;
  const jitter = params.jitter ?? 0.5;
  const attempts = params.attempts ?? 5; // Default to 5 attempts for robustness
  const baseSeed = params.seed ?? (hashEdges(graph.edges) || 123456);

  // adjacency set
  const adj = new Set<string>();
  for (const [i, j] of graph.edges) {
    const k = i < j ? `${i},${j}` : `${j},${i}`;
    adj.add(k);
  }
  const isEdge = (i: number, j: number) => {
    const k = i < j ? `${i},${j}` : `${j},${i}`;
    return adj.has(k);
  };

  // Helper to run simulation once
  const runSimulation = (currentSeed: number) => {
    const rand = mulberry32(currentSeed);
    const pts: Vec2[] = [];
    const R = target * (0.8 * n);

    // Random initial placement (on circle + jitter)
    // We shuffle indices on the circle to avoid bias from input node order
    const indices = Array.from({ length: n }, (_, i) => i);
    // Fisher-Yates shuffle using our rand
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (let k = 0; k < n; k++) {
      const i = indices[k]; // Virtual index position
      // Place node 'i' at angle k
      const a = (2 * Math.PI * k) / n;
      const jx = (rand() - 0.5) * target * jitter;
      const jy = (rand() - 0.5) * target * jitter;
      // We need to map back: pts[node_id] needs to be at this position.
      // But pts array is indexed by node_id.
      // So we fill pts directly but based on shuffled positions?
      // Wait. simpler: Just iterate node 0..n and assign random pos.
      // The shuffle helps if we place them sequentially on a ring.
      // Let's just do random placement in a box for variety if jitter is high?
      // Or shuffled ring.
    }

    // Easier: Just standard ring with heavy jitter is usually fine IF we have multiple seeds.
    // Let's stick to the shuffled ring idea effectively by using the random seed in the loop.
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n; // This biases node 0 to 0 deg.
      // To decouple node index from geometric angle, we add a random phase or shuffle.
      // Let's just use the random jitter which is quite large.
      // Actually, for small graphs, order matters. P4 (0-1-2-3) on circle 0,1,2,3 is OK.
      // P4 (0-2-3-1) on circle 0,1,2,3 is tangled.
      // So we MUST shuffle the initial angular positions or assignments.
      // Let's assign random angles instead of fixed grid.
      const angle = rand() * 2 * Math.PI;
      const rad = R * (0.5 + 0.5 * rand());
      pts.push({ x: Math.cos(angle) * rad, y: Math.sin(angle) * rad });
    }

    for (let it = 0; it < iterations; it++) {
      // ... (physics logic same as before)
      // 1) Edges
      for (const [i, j] of graph.edges) {
        const a = pts[i];
        const b = pts[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
        const ux = dx / d;
        const uy = dy / d;
        const err = d - target;
        const factor = err < 0 ? 0.8 : edgeK;
        const step = err * 0.5 * factor;
        a.x += ux * step;
        a.y += uy * step;
        b.x -= ux * step;
        b.y -= uy * step;
      }
      // 2) Non-edges
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (isEdge(i, j)) continue;
          const a = pts[i];
          const b = pts[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          if (d < 1e-6) { dx = 1; dy = 0; d = 1; }

          // CRITICAL FIX:
          // Enforce a small safety margin (gap) for non-edges.
          // We want non-adjacent disks to be at least 1.05 * target apart
          // so they clearly don't look like they are touching.
          const safeDist = target * 1.1;

          if (d >= safeDist) continue;

          const ux = dx / d;
          const uy = dy / d;
          const push = (safeDist - d) * 0.5 * repelK; // repelK is 1.0 now
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
        }
      }
      // 3) Hard Collision
      for (let k = 0; k < 5; k++) {
        let moved = false;
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const a = pts[i];
            const b = pts[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let d = Math.hypot(dx, dy);
            if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
            if (d < target - 1e-4) {
              const overlap = target - d;
              const ux = dx / d;
              const uy = dy / d;
              const moveX = ux * overlap * 0.5;
              const moveY = uy * overlap * 0.5;
              a.x -= moveX;
              a.y -= moveY;
              b.x += moveX;
              b.y += moveY;
              moved = true;
            }
          }
        }
        if (!moved) break;
      }
      // 4) Cooling / Centering
      if (it % 20 === 0) {
        let cx = 0, cy = 0;
        for (const p of pts) { cx += p.x; cy += p.y; }
        cx /= n; cy /= n;
        for (const p of pts) { p.x -= cx * 0.05; p.y -= cy * 0.05; }
      }
    }

    // Calculate energy (violation)
    let energy = 0;
    // Edge violation (should be exactly target)
    for (const [i, j] of graph.edges) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      energy += Math.pow(d - target, 2);
    }
    // Non-edge violation (overlap or too close)
    const safeDist = target * 1.1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (isEdge(i, j)) continue;
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < safeDist) {
          // Heavy penalty for being closer than safeDist
          energy += Math.pow(safeDist - d, 2) * 10;
        }
      }
    }
    return { pts, energy };
  };

  // Run multiple attempts
  let bestPts: Vec2[] = [];
  let minEnergy = Infinity;

  for (let attempt = 0; attempt < attempts; attempt++) {
    // Use distinct seed for each attempt
    const seed = baseSeed + attempt * 7919;
    const { pts, energy } = runSimulation(seed);
    if (energy < minEnergy) {
      minEnergy = energy;
      bestPts = pts;
    }
    // Short circuit if perfect? Floating point macht strict 0 hard.
    if (energy < 1e-3) break;
  }

  // Use best points
  const points: Point[] = bestPts.map((p, idx) => ({
    id: `p${idx + 1}`,
    kind: "point",
    x: p.x,
    y: p.y,
  }));

  const primitives: Primitive[] = graph.edges.map(([i, j]) => {
    const a = `p${i + 1}`;
    const b = `p${j + 1}`;
    const seg: Segment = { id: segId(a, b), kind: "segment", a, b };
    return seg;
  });

  return { ...base, radius, points, primitives };
}
