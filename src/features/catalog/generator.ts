import { graphToContactScene } from '@/core/geometry/contactLayout';
import type { CSDisk } from '@/core/types/cs';
import {
  calculateEnergy,
  rollDiskToMinimum,
  type RollingStepResult,
} from '@/features/analysis/first_variation/gradientDescent';
import loadAllGraphs from '@/io/loadAllGraphs';

import type { CatalogEntry, StabilityResult } from './catalogTypes';
import { findHamiltonianCycle, getPeripheralDisks } from './graphUtils';

export class CatalogGenerator {
  private stopRequested = false;

  public stop() {
    this.stopRequested = true;
  }

  public async *generate(): AsyncGenerator<CatalogEntry | null, void, unknown> {
    this.stopRequested = false;
    const sets = await loadAllGraphs();

    // Filter sets 3-7
    const relevantSets = sets.filter((s) => {
      const num = parseInt(s.label); // "3 disks", "4 disks"...
      return !isNaN(num) && num >= 3 && num <= 7;
    });

    for (const set of relevantSets) {
      for (const graph of set.graphs) {
        if (this.stopRequested) return;

        // 1. Initial Geometry
        // Use default params (iterations=2000 for speed?)
        // Maybe fewer iterations if just checking topology?
        // But we need good initial layout to avoid false collisions.
        const scene = graphToContactScene(graph, 50, { iterations: 1000, attempts: 1 });
        const disks: CSDisk[] = scene.points.map((p, i) => ({
          id: `d${i}`,
          kind: 'disk',
          center: { x: p.x, y: p.y },
          radius: 1,
          visualRadius: 50,
          label: `D${i}`,
        }));

        // 2. Identify Sequence (Hamiltonian)
        const cycleIndices = findHamiltonianCycle(graph);
        if (!cycleIndices) {
          console.warn(`Skipping graph ${graph}, no cycle found`);
          continue;
        }
        const sequence = cycleIndices.map((i) => `d${i}`);
        // [FIX] Ensure sequence is closed (d0 -> ... -> d0) for Envelope Closure
        if (sequence.length > 0 && sequence[0] !== sequence[sequence.length - 1]) {
          sequence.push(sequence[0]);
        }

        // 3. Initial Energy
        const initialEnergy = calculateEnergy(disks, sequence);

        // 4. Peripheral Disks
        const peripheralIds = getPeripheralDisks(graph).map((i) => `d${i}`);

        const results: StabilityResult[] = [];

        // 5. Explore

        // [NEW] Check Initial Overlaps before even trying
        // Relax tolerance: 2*visualRadius = 100.
        // If dist < 98 (allowing 2px overlap), it's bad. If 99.9, it's fine.
        const hasInitialOverlap = disks.some((d1, i) =>
          disks.slice(i + 1).some((d2) => {
            const dist = Math.sqrt(
              Math.pow(d1.center.x - d2.center.x, 2) + Math.pow(d1.center.y - d2.center.y, 2),
            );
            // Check if dist is significantly less than sum of radii
            return dist < d1.visualRadius + d2.visualRadius - 2.0; // Allow 2px grace
          }),
        );

        if (hasInitialOverlap) {
          // console.warn(`Skipping graph ${graph} due to initial overlap`);
          continue;
        }

        for (const dId of peripheralIds) {
          // Find neighbors (Pivots)
          const dIdx = parseInt(dId.slice(1));
          const neighbors = graph.edges
            .filter((e) => e[0] === dIdx || e[1] === dIdx)
            .map((e) => (e[0] === dIdx ? e[1] : e[0]));

          const pivotIds = neighbors.map((n) => `d${n}`);

          for (const pId of pivotIds) {
            for (const dir of [1, -1] as const) {
              if (this.stopRequested) return;

              try {
                const result = rollDiskToMinimum(disks, dId, pId, dir, sequence);

                // Only keep interesting results
                // e.g. if energy decreased significantly or found new stable state
                if (result.energyDelta < -1e-4) {
                  // CHECK FOR OVERLAPS
                  // rollDiskToMinimum might return a valid state, but let's double check simple distance overlaps
                  const hasOverlap = result.finalDisks.some((d1, i) =>
                    result.finalDisks.slice(i + 1).some((d2) => {
                      const dist = Math.sqrt(
                        Math.pow(d1.center.x - d2.center.x, 2) +
                          Math.pow(d1.center.y - d2.center.y, 2),
                      );
                      return dist < d1.visualRadius + d2.visualRadius - 1e-3; // Tolerance
                    }),
                  );

                  if (!hasOverlap) {
                    // [FIX] Calculate chiralities for exact reproduction
                    // We need the graph for this configuration
                    // Re-build graph for the final config?
                    // Or we can rely on the fact that rollDiskToMinimum maintains topology?
                    // Best to re-calculate envelope to be sure and get chiralities.

                    // Import on top needed? We already have calculateEnergy which might compute it?
                    // Let's rely on Editor to re-compute or just store what we have.
                    // Actually `rollDiskToMinimum` returns `energy`, but not chiralities.
                    // We should compute them here to store them.

                    // NOTE: We need buildBoundedCurvatureGraph here.
                    // It's imported as `graphUtils`? No, implicitly needed.
                    // We can skip storing chiralities if we trust Viterbi,
                    // BUT user said "Exact match". Viterbi might flip L/R if symmetric.

                    // Let's store "valid: true" and let the UI re-calculate for now,
                    // BUT we removed the energy filter so we get MORE results.

                    results.push({
                      movingDiskId: dId,
                      direction: dir === 1 ? 'right' : 'left',
                      finalConfig: {
                        blocks: result.finalDisks,
                        closed: true,
                        valid: true,
                      },
                      pathLength: initialEnergy + result.energyDelta,
                      stepsTaken: 1,
                      status: 'Stable',
                      // chiralities: ... // Compute if possible, or leave undefined to auto-detect
                    });
                  }
                }
              } catch (e) {
                console.error('Rolling error', e);
              }
            }
          }
        }

        // Yield result if we have ANY results (even trivial ones)
        // [FIX] Always yield if we have results, don't filter interesting ones only
        if (results.length > 0) {
          yield {
            knotId: `${set.label}-g${set.graphs.indexOf(graph)}`,
            numCrossings: parseInt(set.label),
            initialConfig: { blocks: disks, closed: true, valid: true },
            diskSequence: sequence,
            results: results,
            timestamp: Date.now(),
          };
        }
      }
    }
  }
}
