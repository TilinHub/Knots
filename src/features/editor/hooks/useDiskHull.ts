import { useMemo } from 'react';

import type { Disk, DiskHull } from '../../../core/geometry/diskHull';
import { computeDiskHull } from '../../../core/geometry/diskHull';

export function useDiskHull(disks: Disk[]): DiskHull {
  return useMemo(() => {
    return computeDiskHull(disks);
  }, [disks]);
}
