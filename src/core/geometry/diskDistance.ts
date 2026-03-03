export type Disk = { x: number; y: number; r: number };

export function diskGapDistance(a: Disk, b: Disk) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return d - (a.r + b.r);
}

export function diskCenterDistance(a: Disk, b: Disk) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
