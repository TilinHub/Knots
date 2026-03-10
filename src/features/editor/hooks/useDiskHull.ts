import { useMemo } from 'react';

import type { Disk, DiskHull } from '../../../core/geometry/hull';
import { computeDiskHull } from '../../../core/geometry/hull';

export function useDiskHull(disks: Disk[]): DiskHull {
  return useMemo(() => {
    return computeDiskHull(disks);
  }, [disks]);
}
