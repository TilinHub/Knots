import { useMemo } from 'react';

import type { DiskHull } from '../../../core/geometry/hull';
import type { Disk } from '../../../core/geometry/hull/diskHull';
import { computeDiskHull } from '../../../core/geometry/hull';

export function useDiskHull(disks: Disk[]): DiskHull {
  return useMemo(() => {
    return computeDiskHull(disks);
  }, [disks]);
}
