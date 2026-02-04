import { useMemo } from 'react';
import type { ContactDisk } from '../../../core/types/contactGraph';
import { buildBoundedCurvatureGraph, type BoundedCurvatureGraph } from '../../../core/geometry/contactGraph';

export function useContactGraph(disks: ContactDisk[]) {
    const graph: BoundedCurvatureGraph = useMemo(() => {
        if (!disks || disks.length < 2) {
            return { nodes: new Map(), edges: [] };
        }
        return buildBoundedCurvatureGraph(disks);
    }, [disks]);

    return graph;
}
