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
      { id: "s1", kind: "segment", a: "p1", b: "p2" },
      { id: "s2", kind: "segment", a: "p2", b: "p3" },
      { id: "s3", kind: "segment", a: "p2", b: "p4" },
      { id: "s4", kind: "segment", a: "p3", b: "p4" },
    ],
  };
}
