import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Logger } from '../../../app/Logger';
import type { DubinsPath } from '../../../core/geometry/dubins';
import {
  type ArcSegment,
  type EnvelopePathResult,
  type EnvelopeSegment,
  findEnvelopePathFromPoints,
  type TangentSegment,
} from '../../../core/geometry/envelope/contactGraph';
import {
  validateNoObstacleIntersection,
  validateNoSelfIntersection,
} from '../../../core/geometry/validation/envelopeValidator';
import type { CSDisk } from '../../../core/types/cs';
import type { Point2D } from '../../../core/types/cs';
import type { DynamicAnchor,UseKnotStateProps } from '../types';


export function useKnotState({ blocks, obstacleSegments = [], ribbonMode = false, ribbonWidth = 20 }: UseKnotStateProps) {
  const [mode, setMode] = useState<'hull' | 'knot'>('hull');
  const [diskSequence, setDiskSequence] = useState<string[]>([]);

  const [anchorSequence, setAnchorSequence] = useState<DynamicAnchor[]>([]);

  const [isDragging, setIsDragging] = useState(false);

  const [chiralities, setChiralities] = useState<('L' | 'R')[]>([]);
  const [lastAnchorPoint, setLastAnchorPoint] = useState<{ x: number; y: number } | null>(null);

  const [lockedChiralities, setLockedChiralities] = useState<('L' | 'R')[]>([]);

  const prevDraggingRef = useRef(isDragging);
  const lastElasticPathRef = useRef<EnvelopeSegment[]>([]);

  // 1. Build contactDisks (Memoized)
  const contactDisks = useMemo(
    () =>
      blocks.map((d) => ({
        id: d.id,
        center: d.center,
        radius: ribbonMode ? (ribbonWidth / 2) : d.visualRadius,
        regionId: 'default',
      })),
    [blocks, ribbonMode, ribbonWidth],
  );

  // Cleanup sequence if disks are removed
  useEffect(() => {
    setDiskSequence((prev) => {
      const next = prev.filter((id) => blocks.some((b) => b.id === id));
      if (next.length !== prev.length) {
        Logger.info('KnotState', 'Cleaned up disk sequence', { removed: prev.length - next.length });
      }
      return next;
    });
    setAnchorSequence((prev) => prev.filter((a) => blocks.some((b) => b.id === a.diskId)));
  }, [blocks]);

  // Recalculate absolute anchor positions (follows disks when moved)
  const currentAnchors = useMemo(() => {
    return anchorSequence.map((anchor) => {
      const disk = blocks.find((b) => b.id === anchor.diskId);
      if (!disk) return { x: 0, y: 0 };
      return {
        x: disk.center.x + disk.visualRadius * Math.cos(anchor.angle),
        y: disk.center.y + disk.visualRadius * Math.sin(anchor.angle),
      };
    });
  }, [anchorSequence, blocks]);

  // 2. Compute Path — restored to 5.5.11 logic: findEnvelopePathFromPoints only
  const computationResult: EnvelopePathResult & { dubinsPaths?: DubinsPath[] } = useMemo(() => {
    if (currentAnchors.length < 2) return { path: [], chiralities: [] };

    const result = findEnvelopePathFromPoints(currentAnchors, contactDisks);

    // Derive chiralities from result
    const derivedChiralities = new Map<string, 'L' | 'R'>();
    result.path.forEach((seg) => {
      const s = seg as any;
      if (s.type === 'ARC') {
        if (s.diskId && !derivedChiralities.has(s.diskId)) {
          derivedChiralities.set(s.diskId, s.chirality);
        }
      } else if (['LSL', 'LSR', 'RSL', 'RSR'].includes(s.type)) {
        if (s.startDiskId && !['point', 'start', 'end'].includes(s.startDiskId) && !derivedChiralities.has(s.startDiskId)) {
          derivedChiralities.set(s.startDiskId, s.type.charAt(0) as 'L' | 'R');
        }
        if (s.endDiskId && !['point', 'start', 'end'].includes(s.endDiskId) && !derivedChiralities.has(s.endDiskId)) {
          derivedChiralities.set(s.endDiskId, s.type.charAt(2) as 'L' | 'R');
        }
      }
    });

    const fullChiralities: ('L' | 'R')[] = diskSequence.map((id, i) => {
      if (derivedChiralities.has(id)) return derivedChiralities.get(id)!;
      if (chiralities.length === diskSequence.length) return chiralities[i];
      return 'L';
    });

    return {
      path: result.path,
      chiralities: fullChiralities,
    };
  }, [currentAnchors, contactDisks, diskSequence, chiralities]);

  // Sync locked chiralities when not dragging
  useEffect(() => {
    if (!isDragging && computationResult.chiralities.length === diskSequence.length) {
      setLockedChiralities(prev => {
        if (prev.join(',') === computationResult.chiralities.join(',')) return prev;
        return computationResult.chiralities;
      });
    }

    if (isDragging && computationResult.path && computationResult.path.length > 0) {
      lastElasticPathRef.current = computationResult.path;
    }
  }, [isDragging, computationResult.chiralities, diskSequence.length, computationResult.path]);

  // Sync anchors after drag drop
  useEffect(() => {
    if (prevDraggingRef.current && !isDragging && lastElasticPathRef.current.length > 0) {
      const newAnchors: DynamicAnchor[] = [];
      diskSequence.forEach((diskId) => {
        const disk = blocks.find((b) => b.id === diskId && b.kind === 'disk');
        if (!disk) return;

        const arc = lastElasticPathRef.current.find((s: any) => s.type === 'ARC' && s.diskId === diskId) as ArcSegment;
        if (arc) {
          newAnchors.push({ diskId, angle: arc.startAngle });
          return;
        }

        const outTangent = lastElasticPathRef.current.find((s: any) => s.startDiskId === diskId) as TangentSegment;
        if (outTangent) {
          const angle = Math.atan2(outTangent.start.y - disk.center.y, outTangent.start.x - disk.center.x);
          newAnchors.push({ diskId, angle });
          return;
        }

        const inTangent = lastElasticPathRef.current.find((s: any) => s.endDiskId === diskId) as TangentSegment;
        if (inTangent) {
          const angle = Math.atan2(inTangent.end.y - disk.center.y, inTangent.end.x - disk.center.x);
          newAnchors.push({ diskId, angle });
          return;
        }
      });

      if (newAnchors.length === diskSequence.length) {
        Logger.info('KnotState', 'Snapped anchors to elastic geometry post-drag');
        setAnchorSequence(newAnchors);
      }
    }
    prevDraggingRef.current = isDragging;
  }, [isDragging, diskSequence, blocks]);

  // 3. Validation
  const validation = useMemo(() => {
    if (!computationResult.path || computationResult.path.length < 3) return { valid: true };

    const selfCheck = validateNoSelfIntersection(computationResult.path);
    if (!selfCheck.valid) return selfCheck;

    if (obstacleSegments.length > 0) {
      const obsCheck = validateNoObstacleIntersection(computationResult.path, obstacleSegments);
      if (!obsCheck.valid) return obsCheck;
    }

    return { valid: true };
  }, [computationResult.path, obstacleSegments]);

  const knotPath = computationResult.path;

  const envelopePath = useMemo(() => {
    if (knotPath.length === 0 || currentAnchors.length < 3) return knotPath;

    const lastAnchor = currentAnchors[currentAnchors.length - 1];
    const firstAnchor = currentAnchors[0];

    // The closing path must not route through disks already used in the main sequence.
    // Only the first and last disk of the sequence are allowed as endpoints.
    const firstDiskId = diskSequence[0];
    const lastDiskId = diskSequence[diskSequence.length - 1];
    const closingForbidden = new Set(
      diskSequence.slice(1, -1).filter(id => id !== firstDiskId && id !== lastDiskId),
    );

    const closingResult = findEnvelopePathFromPoints([lastAnchor, firstAnchor], contactDisks, closingForbidden);

    if (closingResult.path.length > 0) {
      return [...knotPath, ...closingResult.path];
    }
    return knotPath;
  }, [knotPath, currentAnchors, contactDisks, diskSequence]);

  const toggleDisk = useCallback(
    (diskId: string) => {
      setDiskSequence((prev) => {
        if (prev.length > 0 && prev[prev.length - 1] === diskId) {
          setTimeout(() => {
            setLastAnchorPoint(null);
            setAnchorSequence((prevA) => prevA.slice(0, -1));
            setChiralities((prevC) => prevC.slice(0, -1));
          }, 0);
          return prev.slice(0, -1);
        }
        setTimeout(() => {
          setChiralities((prevC) => [...prevC, 'L']);
        }, 0);
        return [...prev, diskId];
      });
    },
    []
  );

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'hull' ? 'knot' : 'hull'));
  }, []);

  const clearSequence = useCallback(() => {
    setDiskSequence([]);
    setChiralities([]);
    setAnchorSequence([]);
    setLastAnchorPoint(null);
  }, []);

  const extendSequenceWithPoint = useCallback(
    (diskId: string, point: { x: number; y: number }) => {
      if (lastAnchorPoint) {
        const dist = Math.sqrt(
          Math.pow(point.x - lastAnchorPoint.x, 2) + Math.pow(point.y - lastAnchorPoint.y, 2),
        );
        if (dist < 1.0) {
          Logger.warn('KnotState', 'Duplicate Point Extension Ignored', { diskId, point, dist });
          return;
        }
      }

      const disk = blocks.find((b) => b.id === diskId);
      if (!disk) return;

      const angle = Math.atan2(point.y - disk.center.y, point.x - disk.center.x);

      setAnchorSequence((prev) => [...prev, { diskId, angle }]);
      setChiralities((prev) => [...prev, 'L']);
      setDiskSequence((prev) => [...prev, diskId]);
      Logger.info('KnotState', 'Extended Sequence with Point', { diskId, point });

      setLastAnchorPoint(point);
    },
    [blocks, lastAnchorPoint],
  );

  const undoLastAction = useCallback(() => {
    setDiskSequence((prev) => prev.slice(0, -1));
    setAnchorSequence((prev) => prev.slice(0, -1));
    setChiralities((prev) => prev.slice(0, -1));
    setLastAnchorPoint(null);
  }, []);

  return {
    mode,
    diskSequence,
    knotPath,
    envelopePath,
    chiralities: computationResult.chiralities,
    anchorPoints: currentAnchors,
    anchorSequence,
    validation,
    flexibleKnotPaths: computationResult.dubinsPaths,
    actions: {
      setMode,
      toggleMode,
      toggleDisk,
      setSequence: setDiskSequence,
      clearSequence,
      setAnchorSequence,
      extendSequenceWithPoint,
      setDragging: setIsDragging,
      setChiralities,
      undoLastAction,
    },
  };
}
