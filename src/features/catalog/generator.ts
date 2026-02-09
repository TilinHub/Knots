
import loadAllGraphs from '@/io/loadAllGraphs';
import { graphToContactScene } from '@/core/geometry/contactLayout';
import { getPeripheralDisks, findHamiltonianCycle } from './graphUtils';
import { rollDiskToMinimum, calculateEnergy, type RollingStepResult } from '@/features/analysis/first_variation/gradientDescent';
import type { CatalogEntry, StabilityResult } from './catalogTypes';
import type { CSDisk } from '@/core/types/cs';

export class CatalogGenerator {
    private stopRequested = false;

    public stop() {
        this.stopRequested = true;
    }

    public async *generate(): AsyncGenerator<CatalogEntry | null, void, unknown> {
        this.stopRequested = false;
        const sets = await loadAllGraphs();

        // Filter sets 3-7
        const relevantSets = sets.filter(s => {
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
                    label: `D${i}`
                }));

                // 2. Identify Sequence (Hamiltonian)
                const cycleIndices = findHamiltonianCycle(graph);
                if (!cycleIndices) {
                    console.warn(`Skipping graph ${graph}, no cycle found`);
                    continue;
                }
                const sequence = cycleIndices.map(i => `d${i}`);
                // [FIX] Ensure sequence is closed (d0 -> ... -> d0) for Envelope Closure
                if (sequence.length > 0 && sequence[0] !== sequence[sequence.length - 1]) {
                    sequence.push(sequence[0]);
                }

                // 3. Initial Energy
                const initialEnergy = calculateEnergy(disks, sequence);

                // 4. Peripheral Disks
                const peripheralIds = getPeripheralDisks(graph).map(i => `d${i}`);

                const results: StabilityResult[] = [];

                // 5. Explore

                // [NEW] Check Initial Overlaps before even trying
                const hasInitialOverlap = disks.some((d1, i) =>
                    disks.slice(i + 1).some(d2 => {
                        const dist = Math.sqrt(Math.pow(d1.center.x - d2.center.x, 2) + Math.pow(d1.center.y - d2.center.y, 2));
                        return dist < (d1.visualRadius + d2.visualRadius - 1e-3);
                    })
                );

                if (hasInitialOverlap) {
                    // console.warn(`Skipping graph ${graph} due to initial overlap`);
                    continue;
                }

                for (const dId of peripheralIds) {
                    // Find neighbors (Pivots)
                    const dIdx = parseInt(dId.slice(1));
                    const neighbors = graph.edges
                        .filter(e => e[0] === dIdx || e[1] === dIdx)
                        .map(e => (e[0] === dIdx ? e[1] : e[0]));

                    const pivotIds = neighbors.map(n => `d${n}`);

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
                                        result.finalDisks.slice(i + 1).some(d2 => {
                                            const dist = Math.sqrt(Math.pow(d1.center.x - d2.center.x, 2) + Math.pow(d1.center.y - d2.center.y, 2));
                                            return dist < (d1.visualRadius + d2.visualRadius - 1e-3); // Tolerance
                                        })
                                    );

                                    if (!hasOverlap) {
                                        results.push({
                                            movingDiskId: dId,
                                            direction: dir === 1 ? 'right' : 'left',
                                            finalConfig: {
                                                blocks: result.finalDisks,
                                                closed: true,
                                                valid: true
                                            },
                                            pathLength: initialEnergy + result.energyDelta,
                                            stepsTaken: 1,
                                            status: 'Stable'
                                        });
                                    }
                                }
                            } catch (e) {
                                console.error("Rolling error", e);
                            }
                        }
                    }
                }

                // Yield result
                // Even if no minima found, maybe report the knot?
                if (results.length > 0) {
                    yield {
                        knotId: `${set.label}-g${set.graphs.indexOf(graph)}`,
                        numCrossings: parseInt(set.label),
                        initialConfig: { blocks: disks, closed: true, valid: true },
                        diskSequence: sequence,
                        results: results,
                        timestamp: Date.now()
                    };
                } else {
                    // Yield null to signal progress without result?
                    yield null;
                }
            }
        }
    }
}
