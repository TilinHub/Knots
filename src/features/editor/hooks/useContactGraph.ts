import { useMemo } from 'react';

import {
  type BoundedCurvatureGraph,
  buildBoundedCurvatureGraph,
} from '../../../core/geometry/contactGraph';
import type { ContactDisk } from '../../../core/types/contactGraph';

export function useContactGraph(disks: ContactDisk[]) {
  const graph: BoundedCurvatureGraph = useMemo(() => {
    if (!disks || disks.length < 2) {
      return { nodes: new Map(), edges: [] };
    }
    return buildBoundedCurvatureGraph(disks);
  }, [disks]);

  return graph;
}
