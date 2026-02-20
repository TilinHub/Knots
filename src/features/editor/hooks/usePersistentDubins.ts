import { useCallback, useMemo, useState } from 'react';

import { findShortestContactPath } from '../../../core/algorithms/pathfinder';
import { type DiskAnchor, solveAngularDubins } from '../../../core/geometry/dubins/angularDubins';
import { buildBoundedCurvatureGraph } from '../../../core/geometry/contactGraph';
import {
  calculateBitangentPaths,
  checkPathCollision,
  type DubinsPath,
  type DubinsType,
  type StoredDubinsPath,
} from '../../../core/geometry/dubins';
import { type ContactDisk } from '../../../core/types/contactGraph';
import { type Point2D } from '../../../core/types/cs';

export interface PersistentDubinsState {
  activeDiskId: string | null;
  hoverDiskId: string | null;
  candidates: DubinsPath[];
  selectedPaths: StoredDubinsPath[];
  visibleSelectedPaths: DubinsPath[];
  pathCache: Map<string, DubinsPath>;
  hoverPathType: DubinsType | null;
  totalLength: number;
}

export function usePersistentDubins(disks: ContactDisk[]) {
  const [selectedPaths, setSelectedPaths] = useState<StoredDubinsPath[]>([]);
  const [activeDiskId, setActiveDiskId] = useState<string | null>(null);
  const [hoverDiskId, setHoverDiskId] = useState<string | null>(null);
  const [hoverPathType, setHoverPathType] = useState<DubinsType | null>(null);

  // State for Anchors
  const [anchorStart, setAnchorStart] = useState<DiskAnchor | null>(null);
  const [anchorEnd, setAnchorEnd] = useState<DiskAnchor | null>(null);

  // 1. Calculate Candidates
  const candidates = useMemo(() => {
    // If we have explicit anchors, use Angular Dubins
    if (anchorStart && anchorEnd) {
      // Pass all other disks as obstacles
      const obstacles = disks
        .filter((d) => d.id !== anchorStart.disk.id && d.id !== anchorEnd.disk.id)
        .map((d) => ({ x: d.center.x, y: d.center.y, radius: d.radius }));

      const path = solveAngularDubins(anchorStart, anchorEnd, obstacles);
      return path ? [path] : [];
    }

    if (!activeDiskId || !hoverDiskId || activeDiskId === hoverDiskId) return [];

    const startDisk = disks.find((d) => d.id === activeDiskId);
    const endDisk = disks.find((d) => d.id === hoverDiskId);

    if (!startDisk || !endDisk) return [];

    const c1 = { x: startDisk.center.x, y: startDisk.center.y, radius: startDisk.radius };
    const c2 = { x: endDisk.center.x, y: endDisk.center.y, radius: endDisk.radius };

    // 1. Try Direct Geometric candidates
    let paths = calculateBitangentPaths(c1, c2);

    // 2. [Multi-Hop] If no direct paths, search graph
    if (paths.length === 0) {
      const graph = buildBoundedCurvatureGraph(disks);
      const compoundPaths = findShortestContactPath(activeDiskId, hoverDiskId, graph);

      compoundPaths.forEach((chain) => {
        paths.push(...chain);
      });
    }

    // Filter collisions dynamically per path
    paths = paths.filter((p) => {
      const sId = p.startDiskId || activeDiskId;
      const eId = p.endDiskId || hoverDiskId;

      const relevantObstacles = disks
        .filter((d) => d.id !== sId && d.id !== eId)
        .map((d) => ({ x: d.center.x, y: d.center.y, radius: d.radius }));

      return !checkPathCollision(p, relevantObstacles, 1.0);
    });

    // [C1 Continuity]
    // Check if there is a selected path ending at activeDiskId
    // The path ends at activeDiskId. So activeDiskId was path.endDiskId.
    const prevPath = selectedPaths.find((p) => p.endDiskId === activeDiskId);

    if (prevPath) {
      // Determine Arrival Winding on activeDiskId from prevPath
      // If prevPath type is 'LSL' or 'RSL' -> Ends with 'L' (CCW)
      // If prevPath type is 'LSR' or 'RSR' -> Ends with 'R' (CW)
      const prevType = prevPath.type;
      const arrivalWinding = prevType === 'LSL' || prevType === 'RSL' ? 'L' : 'R';

      // Next path MUST Start with 'L' if arrival was 'L'
      // and 'R' if arrival was 'R' to be C1 continuous (wrapping around disk).
      // Filter candidates.
      paths = paths.filter((p) => {
        const startWinding = p.type === 'LSL' || p.type === 'LSR' ? 'L' : 'R';
        return startWinding === arrivalWinding;
      });
    }

    return paths;
  }, [activeDiskId, hoverDiskId, disks, selectedPaths, anchorStart, anchorEnd]);

  // 2. Cache Selected Paths
  const pathCache = useMemo(() => {
    const cache = new Map<string, DubinsPath>();

    selectedPaths.forEach((sp) => {
      const startDisk = disks.find((d) => d.id === sp.startDiskId);
      const endDisk = disks.find((d) => d.id === sp.endDiskId);
      if (!startDisk || !endDisk) return;

      const c1 = { x: startDisk.center.x, y: startDisk.center.y, radius: startDisk.radius };
      const c2 = { x: endDisk.center.x, y: endDisk.center.y, radius: endDisk.radius };

      // Re-calculate all to find match
      const paths = calculateBitangentPaths(c1, c2);
      const match = paths.find((p) => p.type === sp.type);

      if (match) {
        cache.set(sp.id, match);
      }
    });

    return cache;
  }, [selectedPaths, disks]);

  // Actions
  const handleDiskClick = (diskId: string, point?: Point2D) => {
    const disk = disks.find((d) => d.id === diskId);
    if (!disk) return;

    // Calculate Angle
    let angle = 0;
    if (point) {
      angle = Math.atan2(point.y - disk.center.y, point.x - disk.center.x);
    }

    const anchor: DiskAnchor = {
      disk: { id: disk.id, center: disk.center, radius: disk.radius },
      angle: angle,
      range: 0.3, // ~17 degrees tolerance
    };

    if (!activeDiskId) {
      setActiveDiskId(diskId);
      setAnchorStart(anchor);
      setAnchorEnd(null); // Reset end
    } else {
      // Completing the connection
      setHoverDiskId(diskId); // Use hover as "target"
      setAnchorEnd(anchor);
      // The Memo will now calculate the Angular Dubins path
    }
  };

  const handlePathClick = (path: DubinsPath) => {
    if (!activeDiskId || !hoverDiskId) return; // Note: hoverDiskId is destination

    // If part of group, find all
    const pathsToAdd: DubinsPath[] = [];
    if (path.groupId) {
      const group = candidates.filter((c) => c.groupId === path.groupId);
      pathsToAdd.push(...group);
    } else {
      pathsToAdd.push(path);
    }

    // Add all to stored paths
    const newStored: StoredDubinsPath[] = pathsToAdd.map((p) => ({
      id: `${Date.now()}-${Math.random()}-${Math.random()}`,
      startDiskId: p.startDiskId || activeDiskId,
      endDiskId: p.endDiskId || hoverDiskId,
      type: p.type,
    }));

    setSelectedPaths((prev) => [...prev, ...newStored]);

    // Auto-advance: New start is the End Disk of the LAST segment
    // If compound, last segment ends at hoverDiskId.
    setActiveDiskId(hoverDiskId);
    setHoverDiskId(null);
    setAnchorStart(anchorEnd); // Advance anchor
    setAnchorEnd(null);
  };

  const clearPaths = useCallback(() => {
    setSelectedPaths([]);
    setActiveDiskId(null);
    setAnchorStart(null);
    setAnchorEnd(null);
  }, []);

  // Interactive Metrics
  const totalLength = useMemo(() => {
    let len = 0;
    pathCache.forEach((p) => (len += p.length));
    return len;
  }, [pathCache]);

  // Helper for rendering
  const visibleSelectedPaths = useMemo(() => {
    const results: DubinsPath[] = [];

    selectedPaths.forEach((sp) => {
      const p = pathCache.get(sp.id);

      // 1. Initial Logic: Try to get cached geometric path
      if (!p) return;

      // 2. Check Collision of the *original* direct path
      const startNodeId = sp.startDiskId || p.startDiskId;
      const endNodeId = sp.endDiskId || p.endDiskId;

      if (!startNodeId || !endNodeId) return;

      const activeObstacles = disks
        .filter((d) => d.id !== startNodeId && d.id !== endNodeId)
        .map((d) => ({ x: d.center.x, y: d.center.y, radius: d.radius }));

      const isBlocked = checkPathCollision(p, activeObstacles, 1.0);

      if (!isBlocked) {
        results.push(p);
      } else {
        // 3. AUTO-REROUTE
        const graph = buildBoundedCurvatureGraph(disks);
        const compoundPaths = findShortestContactPath(startNodeId, endNodeId, graph);

        if (compoundPaths.length > 0 && compoundPaths[0].length > 0) {
          results.push(...compoundPaths[0]);
        }
      }
    });

    return results;
  }, [selectedPaths, pathCache, disks]);

  return {
    state: {
      activeDiskId,
      hoverDiskId,
      candidates,
      selectedPaths,
      visibleSelectedPaths,
      pathCache,
      hoverPathType,
      totalLength,
    },
    actions: {
      setActiveDiskId,
      setHoverDiskId,
      setHoverPathType,
      handleDiskClick,
      handlePathClick,
      clearPaths,
    },
  };
}
