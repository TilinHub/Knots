export type XYPoint = { id: string; x: number; y: number };

export function resolveOverlapsSingleMove<T extends XYPoint>(args: {
  movedId?: string;
  points: T[];
  radius: number;
  iterations?: number;
}): T[] {
  const { movedId, points, radius } = args;
  const iterations = args.iterations ?? 10;

  const positions = points.map((p) => ({ id: p.id, x: p.x, y: p.y }));

  const minD = 2 * radius;

  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const p1 = positions[i];
        const p2 = positions[j];

        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const d = Math.hypot(dx, dy);

        if (d < 1e-9) {
          if (p1.id === movedId) {
            p1.x += minD;
          } else if (p2.id === movedId) {
            p2.x += minD;
          } else {
            p1.x += minD / 2;
            p2.x -= minD / 2;
          }
          continue;
        }

        if (d < minD) {
          const push = minD - d;
          const ux = dx / d;
          const uy = dy / d;

          if (p1.id === movedId) {
            p1.x += ux * push;
            p1.y += uy * push;
          } else if (p2.id === movedId) {
            p2.x -= ux * push;
            p2.y -= uy * push;
          } else {
            const halfPush = push / 2;
            p1.x += ux * halfPush;
            p1.y += uy * halfPush;
            p2.x -= ux * halfPush;
            p2.y -= uy * halfPush;
          }
        }
      }
    }
  }

  return points.map((p) => {
    const finalPos = positions.find((pos) => pos.id === p.id);
    if (!finalPos) return p;
    if (finalPos.x !== p.x || finalPos.y !== p.y) {
      return { ...p, x: finalPos.x, y: finalPos.y };
    }
    return p;
  });
}
