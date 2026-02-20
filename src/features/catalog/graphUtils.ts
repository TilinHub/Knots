import type { Graph } from '../../io/parseGraph6';

/**
 * Identifies "peripheral" disks in the graph.
 * Heuristic: Disks with degree <= 2 in the contact graph.
 * These disks have enough "freedom" to roll.
 */
export function getPeripheralDisks(graph: Graph): number[] {
  const degrees = new Map<number, number>();
  graph.nodes.forEach((_, i) => degrees.set(i, 0));

  for (const [u, v] of graph.edges) {
    degrees.set(u, (degrees.get(u) || 0) + 1);
    degrees.set(v, (degrees.get(v) || 0) + 1);
  }

  const peripheral: number[] = [];
  degrees.forEach((deg, id) => {
    if (deg <= 2) {
      peripheral.push(id);
    }
  });

  // Fallback: If no degree <= 2 (e.g. all 3), return all?
  // Or maybe just the ones on the convex hull of the graph layout?
  // For now, if empty, return all (assuming specialized structure or just brute force).
  if (peripheral.length === 0) {
    return graph.nodes.map((_, i) => i);
  }

  return peripheral;
}

/**
 * Finds a Hamiltonian Cycle (or largest cycle) in the graph.
 * Used to determine the sequential order of disks for envelope calculation.
 * Returns array of Disk IDs (indices).
 */
export function findHamiltonianCycle(graph: Graph): number[] | null {
  const n = graph.nodes.length;
  const adj = new Map<number, number[]>();

  for (const [u, v] of graph.edges) {
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(u)!.push(v);
    adj.get(v)!.push(u);
  }

  const visited = new Set<number>();
  const path: number[] = [];

  function dfs(u: number): boolean {
    path.push(u);
    visited.add(u);

    if (path.length === n) {
      // Check if last connects to first
      const neighbors = adj.get(u) || [];
      if (neighbors.includes(path[0])) {
        return true; // Cycle found
      }
    } else {
      const neighbors = adj.get(u) || [];
      // Sort neighbors by degree? Or random?
      // Simple backtracking
      for (const v of neighbors) {
        if (!visited.has(v)) {
          if (dfs(v)) return true;
        }
      }
    }

    // Backtrack
    visited.delete(u);
    path.pop();
    return false;
  }

  // Start DFS from node 0
  if (dfs(0)) {
    return path;
  }

  // If no Hamiltonian cycle, maybe just return DFS traversal order?
  // Or return null.
  // Most knots *should* have a Hamiltonian cycle (the knot itself).
  return null;
}
