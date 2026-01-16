export type Disk = { x: number; y: number; r: number };

export function diskGapDistance(a: Disk, b: Disk) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const gap = d - (a.r + b.r);
  return gap <= 0 ? 0 : gap;
}

export function diskCenterDistance(a: Disk, b: Disk) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
