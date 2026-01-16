export type XYPoint = { id: string; x: number; y: number };

export function resolveOverlapsSingleMove<T extends XYPoint>(args: {
  movedId: string;
  points: T[];
  radius: number;
  iterations?: number;
}): T[] {
  const { movedId, points, radius } = args;
  const iterations = args.iterations ?? 6;

  const movedIndex = points.findIndex((p) => p.id === movedId);
  if (movedIndex < 0) return points;

  // Copia mutable solo del movido
  let mx = points[movedIndex].x;
  let my = points[movedIndex].y;

  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < points.length; i++) {
      if (i === movedIndex) continue;

      const other = points[i];
      const dx = mx - other.x;
      const dy = my - other.y;
      const d = Math.hypot(dx, dy);

      const minD = 2 * radius;

      if (d < 1e-9) {
        mx += minD;
        continue;
      }

      if (d < minD) {
        const push = minD - d;
        const ux = dx / d;
        const uy = dy / d;
        mx += ux * push;
        my += uy * push;
      }
    }
  }

  // Devuelve el mismo tipo T, preservando todas las props (kind, etc.)
  return points.map((p) => (p.id === movedId ? ({ ...p, x: mx, y: my } as T) : p));
}
