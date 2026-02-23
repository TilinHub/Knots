import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildBoundedCurvatureGraph,
  type EnvelopePathResult,
  type EnvelopeSegment,
  type ArcSegment,
  type TangentSegment,
  findEnvelopePath,
} from '../../../core/geometry/contactGraph';
import type { DubinsPath } from '../../../core/geometry/dubins';
import type { CSDisk } from '../../../core/types/cs';
import { Logger } from '../../../core/utils/Logger';
import {
  validateNoObstacleIntersection,
  validateNoSelfIntersection,
} from '../../../core/validation/envelopeValidator';
import { EnvelopePathCalculator } from '../../dubins/logic/EnvelopePathCalculator';

interface UseKnotStateProps {
  blocks: CSDisk[];
  obstacleSegments?: { p1: { x: number; y: number }; p2: { x: number; y: number } }[];
}

export interface DynamicAnchor {
  diskId: string;
  angle: number; // Angle relative to disk center
}

export function useKnotState({ blocks, obstacleSegments = [] }: UseKnotStateProps) {
  const [mode, setMode] = useState<'hull' | 'knot'>('hull');
  const [diskSequence, setDiskSequence] = useState<string[]>([]);

  // Dynamic Anchors (stored as relative angles, used for rendering dots + post-drag snap)
  const [anchorSequence, setAnchorSequence] = useState<DynamicAnchor[]>([]);

  // Freeze chiralities during drag to prevent topology flips mid-movement
  const [isDragging, setIsDragging] = useState(false);

  const recalcLockRef = useRef(false);
  const recalcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [chiralities, setChiralities] = useState<('L' | 'R')[]>([]);
  const [lastAnchorPoint, setLastAnchorPoint] = useState<{ x: number; y: number } | null>(null);

  // Locked chiralities: frozen at drag-start, prevents topology flips mid-drag
  const [lockedChiralities, setLockedChiralities] = useState<('L' | 'R')[]>([]);

  // 1. Build ContactDisks list (Memoized)
  const contactDisks = useMemo(
    () =>
      blocks.map((d) => ({
        id: d.id,
        center: d.center,
        radius: d.visualRadius,
        regionId: 'default',
      })),
    [blocks],
  );

  // Pre-built bounded curvature graph:
  // checkCollisions=true  → outer tangents skip disks they'd penetrate
  // outerTangentsOnly=false → inner tangents (LSR/RSL) allowed for CS crossing diagrams
  const contactGraph = useMemo(
    () => buildBoundedCurvatureGraph(contactDisks, true, [], false),
    [contactDisks],
  );

  // Cleanup sequence if disks are removed
  useEffect(() => {
    setDiskSequence((prev) => {
      const next = prev.filter((id) => blocks.some((b) => b.id === id));
      if (next.length !== prev.length) {
        Logger.info('KnotState', 'Cleaned up disk sequence', {
          removed: prev.length - next.length,
        });
      }
      return next;
    });
    setAnchorSequence((prev) => prev.filter((a) => blocks.some((b) => b.id === a.diskId)));
  }, [blocks]);

  // Recalculate absolute anchor positions (reactive to disk movement) — for rendering dots only
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

  // 2. Compute Path — Elastic Topological Solver (always, not just during drag)
  // This guarantees the envelope follows disk surfaces via tangent lines,
  // never penetrates/overlaps any disk, and adapts instantly to disk movement.
  const computationResult: EnvelopePathResult & { dubinsPaths?: DubinsPath[] } = useMemo(() => {
    if (diskSequence.length < 2) return { path: [], chiralities: [] };

    // During drag: freeze chiralities to prevent topology flips mid-movement.
    // At rest: use stored chiralities as hints so the user's intent is preserved.
    const chiralitiesHint: ('L' | 'R')[] | undefined =
      isDragging && lockedChiralities.length === diskSequence.length
        ? lockedChiralities
        : chiralities.length === diskSequence.length
          ? chiralities
          : undefined;

    // Primary: chirality-guided elastic path
    let elasticResult = findEnvelopePath(contactGraph, diskSequence, chiralitiesHint, false);

    // Relaxed fallback: let solver pick chiralities freely if guided version fails
    if (!elasticResult || elasticResult.path.length === 0) {
      elasticResult = findEnvelopePath(contactGraph, diskSequence, undefined, false);
    }

    const path: EnvelopeSegment[] = elasticResult?.path ?? [];

    // Derive chiralities from actual path segment types (LSL/RSR/LSR/RSL encode L/R per disk)
    const derivedChiralities = new Map<string, 'L' | 'R'>();
    path.forEach((seg) => {
      const s = seg as any;
      if (s.type === 'ARC') {
        if (s.diskId) derivedChiralities.set(s.diskId, s.chirality);
      } else if (['LSL', 'LSR', 'RSL', 'RSR'].includes(s.type)) {
        const type = s.type as string;
        if (s.startDiskId && s.startDiskId !== 'point' && s.startDiskId !== 'start') {
          derivedChiralities.set(s.startDiskId, type.charAt(0) as 'L' | 'R');
        }
        if (s.endDiskId && s.endDiskId !== 'point' && s.endDiskId !== 'end') {
          derivedChiralities.set(s.endDiskId, type.charAt(2) as 'L' | 'R');
        }
      }
    });

    // Build resolved chiralities array aligned to diskSequence order
    const resolvedChiralities: ('L' | 'R')[] = diskSequence.map((id, i) => {
      if (derivedChiralities.has(id)) return derivedChiralities.get(id)!;
      if (chiralities.length === diskSequence.length) return chiralities[i];
      return 'L';
    });

    // Dubins paths for visualization (skip during drag to save CPU cycles)
    let dubinsPaths: DubinsPath[] = [];
    if (!isDragging && resolvedChiralities.length === diskSequence.length) {
      try {
        const calculator = new EnvelopePathCalculator();
        dubinsPaths = calculator.calculateKnotPath(blocks, diskSequence, resolvedChiralities, true);
      } catch (e) {
        Logger.warn('KnotState', 'Dubins path computation failed', e);
      }
    }

    Logger.debug('KnotState', 'Computed Elastic Envelope', {
      pathLen: path.length,
      dubinsLen: dubinsPaths.length,
    });

    return { path, chiralities: resolvedChiralities, dubinsPaths };
  }, [contactGraph, blocks, diskSequence, chiralities, isDragging, lockedChiralities]);

  const prevDraggingRef = useRef(isDragging);
  const lastElasticPathRef = useRef<EnvelopeSegment[]>([]);

  // Sync locked chiralities when steady
  useEffect(() => {
    if (!isDragging && computationResult.chiralities.length === diskSequence.length) {
      setLockedChiralities(computationResult.chiralities);
    }

    // Track the last valid elastic path during drag
    if (isDragging && computationResult.path && computationResult.path.length > 0) {
      lastElasticPathRef.current = computationResult.path;
    }
  }, [isDragging, computationResult.chiralities, diskSequence.length, computationResult.path]);

  // Sync mathematical anchors upon DROP to avoid snap-back deformation
  useEffect(() => {
    if (prevDraggingRef.current && !isDragging && lastElasticPathRef.current.length > 0) {
      const newAnchors: DynamicAnchor[] = [];
      diskSequence.forEach((diskId) => {
        const disk = blocks.find((b) => b.id === diskId && b.kind === 'disk');
        if (!disk) return;

        // Priority 1: Find the ARC segment for this disk
        const arc = lastElasticPathRef.current.find(
          (s: any) => s.type === 'ARC' && s.diskId === diskId,
        ) as ArcSegment;
        if (arc) {
          newAnchors.push({ diskId, angle: arc.startAngle });
          return;
        }

        // Priority 2: Find outgoing tangent
        const outTangent = lastElasticPathRef.current.find(
          (s: any) => s.startDiskId === diskId,
        ) as TangentSegment;
        if (outTangent) {
          const angle = Math.atan2(
            outTangent.start.y - disk.center.y,
            outTangent.start.x - disk.center.x,
          );
          newAnchors.push({ diskId, angle });
          return;
        }

        // Priority 3: Find incoming tangent
        const inTangent = lastElasticPathRef.current.find(
          (s: any) => s.endDiskId === diskId,
        ) as TangentSegment;
        if (inTangent) {
          const angle = Math.atan2(
            inTangent.end.y - disk.center.y,
            inTangent.end.x - disk.center.x,
          );
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

  // ═══════════════════════════════════════════════════════════════
  // AUTO-CORRECCIÓN: Recalcular topología si path se invalida
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (isDragging) return;
    if (diskSequence.length < 2) return;

    const pathIsEmpty = computationResult.path.length === 0;
    const pathIsTooShort = computationResult.path.length < diskSequence.length - 1;

    if (!pathIsEmpty && !pathIsTooShort) return;
    if (recalcLockRef.current) {
      Logger.debug('KnotState', 'Recalc locked');
      return;
    }

    Logger.warn('KnotState', 'Invalid Path Detected - Triggering Auto-Correction', {
      diskSeqLen: diskSequence.length,
      pathLen: computationResult.path.length,
      anchorsCount: anchorSequence.length,
    });

    recalcLockRef.current = true;

    try {
      const graph = buildBoundedCurvatureGraph(contactDisks, true, [], true);

      if (graph.edges.length === 0) {
        Logger.error('KnotState', 'Auto-Correction Failed: Empty Graph');
        return;
      }

      const elasticResult = findEnvelopePath(graph, diskSequence, undefined, false);

      if (elasticResult.path.length === 0) {
        Logger.error('KnotState', 'Auto-Correction Failed: Elastic Solver found no path');
        return;
      }

      const newAnchors: DynamicAnchor[] = [];
      const seenDisks = new Set<string>();

      elasticResult.path.forEach((seg) => {
        if (!('startDiskId' in seg)) return;
        const s = seg as any;
        const diskId = s.startDiskId || s.diskId;

        if (!diskId || diskId === 'start' || diskId === 'end' || diskId === 'point') return;
        if (seenDisks.has(diskId)) return;

        const disk = blocks.find((b) => b.id === diskId && b.kind === 'disk');
        if (!disk) return;

        const startPt =
          s.type === 'ARC'
            ? {
                x: disk.center.x + disk.visualRadius * Math.cos(s.startAngle),
                y: disk.center.y + disk.visualRadius * Math.sin(s.startAngle),
              }
            : s.start;

        const angle = Math.atan2(startPt.y - disk.center.y, startPt.x - disk.center.x);

        newAnchors.push({ diskId, angle });
        seenDisks.add(diskId);
      });

      if (newAnchors.length < 2) {
        Logger.error('KnotState', 'Auto-Correction Failed: Insufficient anchors extracted', {
          count: newAnchors.length,
        });
        return;
      }

      Logger.info('KnotState', 'Topology Reconstructed', { anchors: newAnchors.length });
      setAnchorSequence(newAnchors);
    } catch (error) {
      Logger.error('KnotState', 'Auto-Correction Error', error);
    } finally {
      if (recalcTimeoutRef.current) {
        clearTimeout(recalcTimeoutRef.current);
      }

      recalcTimeoutRef.current = setTimeout(() => {
        recalcLockRef.current = false;
        Logger.debug('KnotState', 'Recalc Lock Released');
      }, 500);
    }

    return () => {
      if (recalcTimeoutRef.current) {
        clearTimeout(recalcTimeoutRef.current);
      }
    };
  }, [
    isDragging,
    diskSequence.length,
    computationResult.path.length,
    contactDisks,
  ]);

  // Actions
  const knotPath = computationResult.path;

  // envelopePath — elastic closed loop via repeated-first-disk trick:
  // findEnvelopePath auto-appends the closing arc when diskIds[0] === diskIds[last],
  // so we don't need a manual point-to-point closing segment anymore.
  const envelopePath = useMemo(() => {
    if (diskSequence.length < 2 || knotPath.length === 0) return knotPath;

    const closedSequence = [...diskSequence, diskSequence[0]];
    const currentChiralities = computationResult.chiralities as ('L' | 'R')[];
    const closedChiralities: ('L' | 'R')[] | undefined =
      currentChiralities.length === diskSequence.length
        ? [...currentChiralities, currentChiralities[0]]
        : undefined;

    const closedResult = findEnvelopePath(contactGraph, closedSequence, closedChiralities, false);

    if (closedResult?.path && closedResult.path.length > 0) {
      return closedResult.path;
    }

    return knotPath;
  }, [knotPath, diskSequence, contactGraph, computationResult.chiralities]);

  const toggleDisk = useCallback((diskId: string) => {
    setDiskSequence((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === diskId) {
        setLastAnchorPoint(null);
        setAnchorSequence((prevA) => prevA.slice(0, -1));
        setChiralities((prevC) => prevC.slice(0, -1));
        return prev.slice(0, -1);
      }
      setChiralities((prevC) => [...prevC, 'L']);
      return [...prev, diskId];
    });
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'hull' ? 'knot' : 'hull'));
  }, []);

  const clearSequence = useCallback(() => {
    setDiskSequence([]);
    setChiralities([]);
    setAnchorSequence([]);
    setLastAnchorPoint(null);
  }, []);

  // Point-based extension (Strict Point-to-Point)
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
      setDiskSequence((prev) => {
        Logger.info('KnotState', 'Extended Sequence with Point', { diskId, point });
        return [...prev, diskId];
      });
      setLastAnchorPoint(point);
    },
    [blocks, lastAnchorPoint],
  );

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
    },
  };
}
