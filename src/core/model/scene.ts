import type { Scene } from "./entities";

export function createInitialScene(): Scene {
  return {
    entities: [
      { id: "n1", kind: "node", x: 0, y: 0, r: 25, label: "N1" },
      { id: "n2", kind: "node", x: 120, y: 40, r: 18, label: "N2" },
    ],
  };
}
