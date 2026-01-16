export type Disk = { id: string; x: number; y: number; r: number };

export type TangentSegment = {
  type: "tangent";
  from: { x: number; y: number };
  to: { x: number; y: number };
  disk1: Disk;
  disk2: Disk;
};

export type ArcSegment = {
  type: "arc";
  disk: Disk;
  startAngle: number;
  endAngle: number;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
};

export type HullSegment = TangentSegment | ArcSegment;

function distance(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

function normalizeAngle(angle: number) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle <= -Math.PI) angle += 2 * Math.PI;
  return angle;
}

function centroid(disks: Disk[]) {
  let cx = 0,
    cy = 0;
  for (const d of disks) {
    cx += d.x;
    cy += d.y;
  }
  return { x: cx / disks.length, y: cy / disks.length };
}

function sortByPolarAngle(disks: Disk[], center: { x: number; y: number }) {
  return disks
    .slice()
    .sort(
      (a, b) =>
        Math.atan2(a.y - center.y, a.x - center.x) -
        Math.atan2(b.y - center.y, b.x - center.x)
    );
}

/**
 * Igual idea que el amigo: para cada dirección, el “extremo” maximiza dot(center, dir) + r. [file:350]
 * Esto da un set de discos candidatos de la envolvente (aprox). [file:350]
 */
function findHullDisks(disks: Disk[], numDirections = 360) {
  if (disks.length <= 1) return disks.slice();
  const hullSet = new Set<string>();

  for (let i = 0; i < numDirections; i++) {
    const angle = (2 * Math.PI * i) / numDirections;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };

    let maxProjection = -Infinity;
    let extreme: Disk | null = null;

    for (const disk of disks) {
      const projection = disk.x * dir.x + disk.y * dir.y + disk.r;
      if (projection > maxProjection) {
        maxProjection = projection;
        extreme = disk;
      }
    }
    if (extreme) hullSet.add(extreme.id);
  }

  return disks.filter((d) => hullSet.has(d.id));
}

/**
 * Tangentes externas para radios iguales (misma fórmula que tu amigo). [file:346]
 */
function externalTangentsEqualRadius(d1: Disk, d2: Disk) {
  const dx = d2.x - d1.x;
  const dy = d2.y - d1.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-10) return null;

  const base = Math.atan2(dy, dx);
  const perp1 = base + Math.PI / 2;
  const perp2 = base - Math.PI / 2;

  return [
    {
      p1: { x: d1.x + d1.r * Math.cos(perp1), y: d1.y + d1.r * Math.sin(perp1) },
      p2: { x: d2.x + d2.r * Math.cos(perp1), y: d2.y + d2.r * Math.sin(perp1) },
    },
    {
      p1: { x: d1.x + d1.r * Math.cos(perp2), y: d1.y + d1.r * Math.sin(perp2) },
      p2: { x: d2.x + d2.r * Math.cos(perp2), y: d2.y + d2.r * Math.sin(perp2) },
    },
  ];
}

/**
 * Selecciona la tangente que “mira hacia afuera” maximizando distancia del punto medio al centro del hull. [file:346]
 */
function selectHullTangent(
  d1: Disk,
  d2: Disk,
  tangents: Array<{ p1: { x: number; y: number }; p2: { x: number; y: number } }> | null,
  hullCenter: { x: number; y: number }
) {
  if (!tangents || tangents.length === 0) return null;
  if (tangents.length === 1) return tangents[0];

  let best = tangents[0];
  let maxD = -Infinity;

  for (const t of tangents) {
    const mid = { x: (t.p1.x + t.p2.x) / 2, y: (t.p1.y + t.p2.y) / 2 };
    const d = distance(mid, hullCenter);
    if (d > maxD) {
      maxD = d;
      best = t;
    }
  }
  return best;
}

/**
 * Genera segmentos + arcos igual que computeHullSegments del amigo. [file:349]
 */
export function computeDiskHull(disks: Disk[]) {
  const hullDisksRaw = findHullDisks(disks, 360);
  if (hullDisksRaw.length === 0) return { hullDisks: [], segments: [] as HullSegment[] };
  if (hullDisksRaw.length === 1) return { hullDisks: hullDisksRaw, segments: [] as HullSegment[] };

  const center = centroid(hullDisksRaw);
  const hullDisks = hullDisksRaw.length <= 2 ? hullDisksRaw : sortByPolarAngle(hullDisksRaw, center);

  const segments: HullSegment[] = [];

  // tangentes entre consecutivos
  for (let i = 0; i < hullDisks.length; i++) {
    const curr = hullDisks[i];
    const next = hullDisks[(i + 1) % hullDisks.length];

    const tangents = externalTangentsEqualRadius(curr, next);
    const sel = selectHullTangent(curr, next, tangents, center);

    if (sel) {
      segments.push({
        type: "tangent",
        from: sel.p1,
        to: sel.p2,
        disk1: curr,
        disk2: next,
      });
    }
  }

  // arcos en cada disco entre tangentes vecinas
  for (let i = 0; i < hullDisks.length; i++) {
    const curr = hullDisks[i];
    const prev = hullDisks[(i - 1 + hullDisks.length) % hullDisks.length];
    const next = hullDisks[(i + 1) % hullDisks.length];

    const prevTangents = externalTangentsEqualRadius(prev, curr);
    const nextTangents = externalTangentsEqualRadius(curr, next);

    const prevT = selectHullTangent(prev, curr, prevTangents, center);
    const nextT = selectHullTangent(curr, next, nextTangents, center);

    if (!prevT || !nextT) continue;

    // en el código del amigo: startAngle usa prevT.p2 sobre curr, endAngle usa nextT.p1 sobre curr. [file:349]
    const startAngle = Math.atan2(prevT.p2.y - curr.y, prevT.p2.x - curr.x);
    const endAngle = Math.atan2(nextT.p1.y - curr.y, nextT.p1.x - curr.x);

    segments.push({
      type: "arc",
      disk: curr,
      startAngle,
      endAngle,
      startPoint: prevT.p2,
      endPoint: nextT.p1,
    });
  }

  return { hullDisks, segments };
}

export function arcSweepFlag(startAngle: number, endAngle: number) {
  // misma idea que en examples.js: usa normalizeAngle(end-start) para decidir sentido. [file:345][file:348]
  const diff = normalizeAngle(endAngle - startAngle);
  // SVG sweep-flag: 1 = clockwise, 0 = counterclockwise (en el sistema de SVG y+ hacia abajo suele invertirse).
  // Nosotros dibujamos con path A y elegimos sweep por signo del diff como en el ejemplo.
  return diff > 0 ? 0 : 1;
}

export function arcLargeFlag(startAngle: number, endAngle: number) {
  // pequeño/grande según |delta| > pi (similar a examples.js cuando arma flags). [file:345]
  return Math.abs(normalizeAngle(endAngle - startAngle)) > Math.PI ? 1 : 0;
}
