
import type { CSDiagram, CSDisk } from '@/core/types/cs';

export type RollingDirection = 'left' | 'right';
export type StabilityStatus = 'Stable' | 'Collision' | 'Error' | 'Unstable';

export interface StabilityResult {
    movingDiskId: string;
    direction: RollingDirection;
    finalConfig: CSDiagram; // Or just disk positions if storage is tight
    pathLength: number;
    stepsTaken: number;
    status: StabilityStatus;
    chiralities?: ('L' | 'R')[]; // [NEW] Store exact topology
}

export interface CatalogEntry {
    knotId: string; // e.g., "3_1", "5_2" or the graph6 code
    numCrossings: number;
    initialConfig: CSDiagram;
    diskSequence: string[]; // [NEW] sequence of disk IDs (e.g. ["d0", "d1", ...])
    results: StabilityResult[];
    timestamp: number;
}

export interface CatalogKnot {
    id: string;
    graphCode: string;
    numDisks: number;
    // ... metadata
}
