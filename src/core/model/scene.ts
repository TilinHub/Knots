import type { Scene } from "./entities";

export function createInitialScene(): Scene {
  return {
    radius: 60,
    points: [
      { id: "p1", kind: "point", x: 0, y: -60 },
      { id: "p2", kind: "point", x: 0, y: 20 },
      { id: "p3", kind: "point", x: -90, y: 80 },
      { id: "p4", kind: "point", x: 90, y: 80 },
    ],
    primitives: [
      // por ahora vacío; después agregamos Segment/Arc para trefoil
    ],
  };
}
