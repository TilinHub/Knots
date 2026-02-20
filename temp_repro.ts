// Mock types
interface Point2D {
  x: number;
  y: number;
}
interface ContactDisk {
  id: string;
  center: Point2D;
  radius: number;
  regionId: string;
}

export function intersectsDisk(p1: Point2D, p2: Point2D, disk: ContactDisk): boolean {
  const cx = disk.center.x;
  const cy = disk.center.y;
  const r = disk.radius;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const fx = p1.x - cx;
  const fy = p1.y - cy;

  const a = dx * dx + dy * dy;

  if (a < 1e-9) {
    // Zero-length segment: check if point is inside disk
    return fx * fx + fy * fy < (r * 0.95) ** 2;
  }

  // --- Method 1: Quadratic (Boundary Crossing) ---
  const bCoeff = 2 * (fx * dx + fy * dy);
  const cCoeff = fx * fx + fy * fy - r * r;
  const discriminant = bCoeff * bCoeff - 4 * a * cCoeff;

  if (discriminant > 0) {
    const sqrtD = Math.sqrt(discriminant);
    const t1 = (-bCoeff - sqrtD) / (2 * a);
    const t2 = (-bCoeff + sqrtD) / (2 * a);

    // [FIX] Allow grazing (shallow intersections)
    // If the chord length is very small, we treat it as a touch/graze, not a collision.
    // Chord length in parametric space: dt = t2 - t1 = sqrtD/a (roughly)
    // Actual chord length approx: dt * segmentLength
    const segmentLenSq = a; // 'a' IS the squared length of the segment (dx*dx + dy*dy)
    const segmentLen = Math.sqrt(segmentLenSq);
    const chordLen = (t2 - t1) * segmentLen;

    // If chord is less than 1% of radius (very strict grazing)
    // 0.1 was too large (5 units for r=50). 0.01 is 0.5 units.
    if (chordLen < r * 0.01) {
      // Grazing/Touching -> Allowed
      return false;
    }

    // Strictly interior crossing: t in (epsilon, 1-epsilon)
    const eps = 0.005;
    if ((t1 > eps && t1 < 1 - eps) || (t2 > eps && t2 < 1 - eps)) {
      return true;
    }
  }

  // --- Method 2: Midpoint Inside Check ---
  // Catches chords where both endpoints are on/near boundary
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const midDistSq = (mx - cx) ** 2 + (my - cy) ** 2;
  if (midDistSq < (r * 0.95) ** 2) {
    return true;
  }

  return false;
}

// Test Cases
const diskB = { id: 'B', center: { x: 20, y: 0 }, radius: 10, regionId: 'r1' };

console.log(
  `Grazing Line y=10 vs Disk B (y=0, r=10): ${intersectsDisk({ x: 0, y: 10 }, { x: 40, y: 10 }, diskB)}`,
);
console.log(
  `Overlap Line y=9.99 vs Disk B (y=0, r=10): ${intersectsDisk({ x: 0, y: 9.99 }, { x: 40, y: 9.99 }, diskB)}`,
);
console.log(
  `Micro-Overlap Line y=9.9999 vs Disk B (y=0, r=10): ${intersectsDisk({ x: 0, y: 9.9999 }, { x: 40, y: 9.9999 }, diskB)}`,
);
