import { createInitialScene } from "../model/scene";
import type { Scene, Point, Primitive, Segment } from "../model/entities";
import type { Graph } from "../../io/parseGraph6";

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
};

export function graphToContactScene(
  graph: Graph,
  radius: number,
  params: LayoutParams = {}
): Scene {
  const base = createInitialScene();

  const n = graph.nodes.length;
  const target = 2 * radius;

  const iterations = params.iterations ?? 1200;
  const edgeK = params.edgeK ?? 0.35;
  const repelK = params.repelK ?? 0.55;
  const jitter = params.jitter ?? 0.15;

  // adjacency para saber si (i,j) es arista
  const adj = new Set<string>();
  for (const [i, j] of graph.edges) {
    const k = i < j ? `${i},${j}` : `${j},${i}`;
    adj.add(k);
  }
  const isEdge = (i: number, j: number) => {
    const k = i < j ? `${i},${j}` : `${j},${i}`;
    return adj.has(k);
  };

  // init posiciones (círculo + jitter)
  const rand = mulberry32(hashEdges(graph.edges) || 123456);
  const pts: Vec2[] = [];
  const R = target * (0.8 * n);
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    const jx = (rand() - 0.5) * target * jitter;
    const jy = (rand() - 0.5) * target * jitter;
    pts.push({ x: Math.cos(a) * R + jx, y: Math.sin(a) * R + jy });
  }

  // iteraciones
  for (let it = 0; it < iterations; it++) {
    // 1) aplicar restricciones de contacto en aristas
    for (const [i, j] of graph.edges) {
      const a = pts[i];
      const b = pts[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d < 1e-6) {
        dx = 1;
        dy = 0;
        d = 1;
      }
      const ux = dx / d;
      const uy = dy / d;

      const err = d - target; // queremos err -> 0
      const step = err * 0.5 * edgeK;

      a.x += ux * step;
      a.y += uy * step;
      b.x -= ux * step;
      b.y -= uy * step;
    }

    // 2) evitar solapamiento en no-aristas (dist >= 2r)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (isEdge(i, j)) continue;

        const a = pts[i];
        const b = pts[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-6) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        if (d >= target) continue;

        const ux = dx / d;
        const uy = dy / d;
        const push = (target - d) * 0.5 * repelK;

        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }

    // 3) “enfriar” un poco hacia el centro para que no se vaya al infinito
    if (it % 20 === 0) {
      let cx = 0;
      let cy = 0;
      for (const p of pts) {
        cx += p.x;
        cy += p.y;
      }
      cx /= n;
      cy /= n;
      for (const p of pts) {
        p.x -= cx * 0.05;
        p.y -= cy * 0.05;
      }
    }
  }

  const points: Point[] = pts.map((p, idx) => ({
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
