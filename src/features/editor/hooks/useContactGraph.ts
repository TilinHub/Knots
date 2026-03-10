import { useMemo, useRef } from 'react';

import {
  type BoundedCurvatureGraph,
  buildBoundedCurvatureGraph,
} from '../../../core/geometry/envelope/contactGraph';
import type { ContactDisk } from '../../../core/types/contactGraph';

export function useContactGraph(disks: ContactDisk[]) {
  const lastValidRef = useRef<BoundedCurvatureGraph>({ nodes: new Map(), edges: [] });

  const graph: BoundedCurvatureGraph = useMemo(() => {
    if (!disks || disks.length < 2) {
      return { nodes: new Map(), edges: [] };
    }
    try {
      const built = buildBoundedCurvatureGraph(disks);
      if (built.edges.length > 0 || disks.length <= 2) {
        lastValidRef.current = built;
      }
      return lastValidRef.current;
    } catch {
      return lastValidRef.current;
    }
  }, [disks]);

  return graph;
}
