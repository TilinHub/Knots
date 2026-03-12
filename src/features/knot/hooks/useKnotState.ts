import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildBoundedCurvatureGraph,
  type EnvelopePathResult,
  type EnvelopeSegment,
  type ArcSegment,
  type TangentSegment,
  findEnvelopePath,
  findEnvelopePathFromPoints,
} from '../../../core/geometry/envelope/contactGraph';
import { buildEnvelopeChain } from '../../../core/algorithms/envelopePath';
import type { EnvelopePoint } from '../../../core/types/knot';
import type { DubinsPath } from '../../../core/geometry/dubins'; // Fixed import
import type { CSDisk } from '../../../core/types/cs';
import { Logger } from '../../../app/Logger';
import {
  validateNoObstacleIntersection,
  validateNoSelfIntersection,
} from '../../../core/geometry/validation/envelopeValidator';
import { EnvelopePathCalculator } from '../../dubins/logic/EnvelopePathCalculator';
import type { CSDiagramState } from '../../../core/geometry/cs';
import { createMathematicalStateFromPath, transitionCSDiagramState } from '../../../core/geometry/cs';
import { solveCSDiagramDelta } from '../../../core/geometry/cs';
import { convertStateToPath } from '../../../core/geometry/cs';
import { computeSequenceEnvelope } from '../../../core/geometry/hull/sequenceHull';
import type { Point2D } from '../../../core/types/cs';

import type { UseKnotStateProps, DynamicAnchor } from '../types';


export function useKnotState({ blocks, obstacleSegments = [], ribbonMode = false, ribbonWidth = 20 }: UseKnotStateProps) {
  const [mode, setMode] = useState<'hull' | 'knot'>('hull'); // 'hull' = off/hidden, 'knot' = active
  const [diskSequence, setDiskSequence] = useState<string[]>([]);

  // [NEW] Dynamic Anchors (Stored as relative angles)
  const [anchorSequence, setAnchorSequence] = useState<DynamicAnchor[]>([]);

  // [FIX] Freeze anchors during drag to prevent deformation
  const [isDragging, setIsDragging] = useState(false);

  // [NEW] Lock refs for debouncing and preventing concurrent recalculations
  const recalcLockRef = useRef(false);
  const recalcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recalcRetryCountRef = useRef(0); // Prevent infinite auto-correction loops
  const lastSeqLenRef = useRef(0); // Reset retry counter when sequence changes

  const [chiralities, setChiralities] = useState<('L' | 'R')[]>([]);
  const [lastAnchorPoint, setLastAnchorPoint] = useState<{ x: number; y: number } | null>(null);

  // [NEW] Lock chiralities when not dragging. Used to bypass geometric tangles when user drags.
  const [lockedChiralities, setLockedChiralities] = useState<('L' | 'R')[]>([]);

  // [CS PROTOCOL] Pure mathematical topological boundaries
  const csStateRef = useRef<CSDiagramState | null>(null);
  const prevDisksRef = useRef<Map<string, Point2D>>(new Map());

  // 1. Build Graph (Memoized)
  const contactDisks = useMemo(
    () =>
      blocks.map((d) => ({
        id: d.id,
        center: d.center,
        // Mathematical Core from the Paper: "When length minimisers in disk diagram space are ribbon...
        // ...The ribbon width is 2 as can be done by a suitable homothety...
        // ...the radius of these empty disks is 1 (W/2)".
        // Override the obstacle radius to precisely half the ribbon width if ribbon mode is active.
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
        Logger.info('KnotState', 'Cleaned up disk sequence', {
          removed: prev.length - next.length,
        });
      }
      return next;
    });
    setAnchorSequence((prev) => prev.filter((a) => blocks.some((b) => b.id === a.diskId)));
  }, [blocks]);

  // [NEW] Recalculate Absolute Positions (Reactive to blocks moving)
  const currentAnchors = useMemo(() => {
    // Always update anchors to follow disks (Elastic Behavior)
    return anchorSequence.map((anchor) => {
      const disk = blocks.find((b) => b.id === anchor.diskId);
      if (!disk) return { x: 0, y: 0 };
      return {
        x: disk.center.x + disk.visualRadius * Math.cos(anchor.angle),
        y: disk.center.y + disk.visualRadius * Math.sin(anchor.angle),
      };
    });
  }, [anchorSequence, blocks]);

  // 2. Compute Path — Memory-based pathfinding with EnvelopePoint bridge
  const computationResult: EnvelopePathResult & { dubinsPaths?: DubinsPath[] } = useMemo(() => {
    const activeAnchors = currentAnchors;

    if (activeAnchors.length < 2 || diskSequence.length < 2) {
      Logger.debug('KnotState', 'Not enough anchors for path', { anchors: activeAnchors.length, disks: diskSequence.length });
      return { path: [], chiralities: [] };
    }

    // --- STEP 1: Build EnvelopePoints from anchorSequence ---
    // Each DynamicAnchor becomes an EnvelopePoint with prev/next links
    const rawEnvelopePoints: EnvelopePoint[] = anchorSequence.map((anchor, i) => {
      const disk = blocks.find((b) => b.id === anchor.diskId);
      const radius = disk ? disk.visualRadius : 1;
      const cx = disk ? disk.center.x : 0;
      const cy = disk ? disk.center.y : 0;
      return {
        id: `ep-${anchor.diskId}-${i}`,
        diskId: anchor.diskId,
        position: {
          x: cx + radius * Math.cos(anchor.angle),
          y: cy + radius * Math.sin(anchor.angle),
        },
        angle: anchor.angle,
        prev: null,
        next: null,
        segmentId: 'main',
      };
    });

    // Assign prev/next links via buildEnvelopeChain
    const linkedPoints = buildEnvelopeChain(rawEnvelopePoints);

    // Group EnvelopePoints by diskId
    const envelopePointsByDisk = new Map<string, EnvelopePoint[]>();
    linkedPoints.forEach(ep => {
      const existing = envelopePointsByDisk.get(ep.diskId) || [];
      existing.push(ep);
      envelopePointsByDisk.set(ep.diskId, existing);
    });

    Logger.debug('KnotState', 'Built EnvelopePoints', {
      total: linkedPoints.length,
      perDisk: Object.fromEntries(Array.from(envelopePointsByDisk.entries()).map(([k, v]) => [k, v.length])),
    });

    // --- STEP 2: Build graph and inject envelopePoints into nodes ---
    const graph = buildBoundedCurvatureGraph(contactDisks, true, [], false);

    graph.nodes.forEach((node, diskId) => {
      (node as any).envelopePoints = envelopePointsByDisk.get(diskId) ?? [];
    });

    // --- STEP 3: Use findEnvelopePath (memory-based) as primary ---
    // Compress consecutive duplicate disks
    const compressedSeq: string[] = [];
    diskSequence.forEach((id, i) => {
      if (i === 0 || id !== diskSequence[i - 1]) compressedSeq.push(id);
    });

    if (compressedSeq.length >= 2) {
      // Append first disk to close the loop
      const closedSeq = [...compressedSeq, compressedSeq[0]];

      Logger.debug('KnotState', 'Calling findEnvelopePath (memory-based)', {
        closedSeq,
        graphNodes: graph.nodes.size,
        graphEdges: graph.edges.length,
      });

      const memoryResult = findEnvelopePath(graph, closedSeq, undefined, false);

      if (memoryResult.path.length > 0) {
        Logger.debug('KnotState', 'Memory-based path computed successfully', {
          segments: memoryResult.path.length,
          types: memoryResult.path.map((s: any) => s.type),
        });

        // Derive chiralities from the computed path
        const derivedChiralities: ('L' | 'R')[] = diskSequence.map(() => 'L');
        memoryResult.path.forEach((seg: any) => {
          if (seg.type === 'ARC' && seg.diskId) {
            const idx = diskSequence.indexOf(seg.diskId);
            if (idx >= 0) derivedChiralities[idx] = seg.chirality;
          }
        });

        return {
          path: memoryResult.path,
          chiralities: derivedChiralities,
          dubinsPaths: [],
        };
      }

      Logger.warn('KnotState', 'Memory-based path returned empty, defaulting to SequenceHull mathematical resolution');

      // 10. Fallback O(N) Topológico: Forzamos la secuencia explícitamente en lugar del grafo intersecado
      const sequenceDisks = compressedSeq.map((id) => blocks.find((b) => b.id === id)).filter((b) => b?.kind === 'disk') as CSDisk[];

      if (sequenceDisks.length === compressedSeq.length) {
          const forcedPath = computeSequenceEnvelope(sequenceDisks, 'L', true);
          if (forcedPath.length > 0) {
              const derivedChiralities: ('L' | 'R')[] = diskSequence.map(() => 'L');
              forcedPath.forEach((seg: any) => {
                if (seg.type === 'ARC' && seg.diskId) {
                  const idx = diskSequence.indexOf(seg.diskId);
                  if (idx >= 0) derivedChiralities[idx] = seg.chirality;
                }
              });

              return {
                  path: forcedPath,
                  chiralities: derivedChiralities,
                  dubinsPaths: [],
              };
          }
      }
    }

    // --- FALLBACK ULTRA-EMERGENCY: Legacy anchor-based pathfinding ---
    Logger.debug('KnotState', 'Using legacy findEnvelopePathFromPoints');
    const result = findEnvelopePathFromPoints(activeAnchors, contactDisks);

    if (result.path.length === 0) {
      Logger.warn('KnotState', 'findEnvelopePathFromPoints returned empty path', {
        anchors: activeAnchors.map((a, i) => ({
          i,
          x: a.x.toFixed(2),
          y: a.y.toFixed(2),
          disk: anchorSequence[i]?.diskId || '?',
        })),
      });
    }

    // Derive chiralities from path segments
    const derivedChiralities: ('L' | 'R')[] = diskSequence.map(() => 'L');
    result.path.forEach((seg: any) => {
      if (seg.type === 'ARC' && seg.diskId) {
        const idx = diskSequence.indexOf(seg.diskId);
        if (idx >= 0) derivedChiralities[idx] = seg.chirality;
      }
    });

    return {
      path: result.path,
      chiralities: derivedChiralities,
      dubinsPaths: [],
    };
  }, [currentAnchors, contactDisks, diskSequence, anchorSequence, blocks]);

  const prevDraggingRef = useRef(isDragging);
  const lastElasticPathRef = useRef<EnvelopeSegment[]>([]);

  // Sync locked chiralities when steady
  useEffect(() => {
    if (!isDragging && computationResult.chiralities.length === diskSequence.length) {
      setLockedChiralities(prev => {
        if (prev.join(',') === computationResult.chiralities.join(',')) return prev;
        return computationResult.chiralities;
      });
    }

    // Track the perfectly solved elastic path during drag
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
        const arc = lastElasticPathRef.current.find((s: any) => s.type === 'ARC' && s.diskId === diskId) as ArcSegment;
        if (arc) {
          newAnchors.push({ diskId, angle: arc.startAngle });
          return;
        }

        // Priority 2: Find outgoing tangent
        const outTangent = lastElasticPathRef.current.find((s: any) => s.startDiskId === diskId) as TangentSegment;
        if (outTangent) {
          const angle = Math.atan2(outTangent.start.y - disk.center.y, outTangent.start.x - disk.center.x);
          newAnchors.push({ diskId, angle });
          return;
        }

        // Priority 3: Find incoming tangent
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

    // Check self-intersection (on legacy path)
    const selfCheck = validateNoSelfIntersection(computationResult.path);
    if (!selfCheck.valid) return selfCheck;

    // Check obstacles
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
    // GUARDS: Condiciones para NO ejecutar
    if (isDragging) return;
    if (diskSequence.length < 2) return;

    const pathIsEmpty = computationResult.path.length === 0;
    const pathIsTooShort = computationResult.path.length < diskSequence.length - 1;

    if (!pathIsEmpty && !pathIsTooShort) return;
    if (recalcLockRef.current) {
      Logger.debug('KnotState', 'Recalc locked');
      return;
    }

    // Reset retry counter when disk sequence changes
    if (diskSequence.length !== lastSeqLenRef.current) {
      lastSeqLenRef.current = diskSequence.length;
      recalcRetryCountRef.current = 0;
    }

    // Prevent infinite auto-correction loops: max 2 retries per sequence
    if (recalcRetryCountRef.current >= 2) {
      Logger.debug('KnotState', 'Auto-correction retry limit reached, skipping');
      return;
    }
    recalcRetryCountRef.current++;

    // Only warn/correct if LEGACY path is broken.
    // If Dubins path works, maybe we don't care?
    // But anchorSequence is derived from path? No, anchorSequence DRIVES the path.

    Logger.warn('KnotState', 'Invalid Path Detected - Triggering Auto-Correction', {
      diskSeqLen: diskSequence.length,
      pathLen: computationResult.path.length,
      anchorsCount: anchorSequence.length,
    });

    // Activar lock ANTES de cualquier modificación de estado
    recalcLockRef.current = true;

    try {
      const graph = buildBoundedCurvatureGraph(contactDisks, true, [], true);

      if (graph.edges.length === 0) {
        Logger.error('KnotState', 'Auto-Correction Failed: Empty Graph');
        return;
      }

      const uniqueDiskSequence: string[] = [];
      diskSequence.forEach((id, i) => {
        if (i === 0 || id !== diskSequence[i - 1]) uniqueDiskSequence.push(id);
      });

      const elasticResult = findEnvelopePath(graph, uniqueDiskSequence, undefined, false);

      if (elasticResult.path.length === 0) {
        Logger.error('KnotState', 'Auto-Correction Failed: Elastic Solver found no path');
        return;
      }

      const newAnchors: DynamicAnchor[] = [];
      const seenDisks = new Set<string>();

      elasticResult.path.forEach((seg) => {
        if (!('startDiskId' in seg)) return; // Access safely?
        // EnvelopeSegment types: Line | Arc. line has start/end.
        // cast to any to access startDiskId if it exists on some variant
        const s = seg as any;
        const diskId = s.startDiskId || s.diskId;

        if (!diskId || diskId === 'start' || diskId === 'end' || diskId === 'point') return;
        if (seenDisks.has(diskId)) return;

        const disk = blocks.find((b) => b.id === diskId && b.kind === 'disk');
        if (!disk) return;

        // Angle from disk center to segment start
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
      // Cleanup del timeout anterior si existe
      if (recalcTimeoutRef.current) {
        clearTimeout(recalcTimeoutRef.current);
      }

      // Programar liberación del lock con debouncing
      recalcTimeoutRef.current = setTimeout(() => {
        recalcLockRef.current = false;
        Logger.debug('KnotState', 'Recalc Lock Released');
      }, 500);
    }

    // Cleanup al desmontar
    return () => {
      if (recalcTimeoutRef.current) {
        clearTimeout(recalcTimeoutRef.current);
      }
    };
  }, [
    isDragging, // Trigger cuando termina drag
    diskSequence.length, // Solo longitud, no array completo
    computationResult.path.length, // Solo longitud
    contactDisks, // dep needed
  ]);

  // Actions
  const knotPath = computationResult.path;

  // envelopePath = knotPath + closing segment (from last anchor to first)
  // this ensures the saved envelope is a closed loop, while the drawing UI remains open
  const envelopePath = useMemo(() => {
    if (knotPath.length === 0 || currentAnchors.length < 3) return knotPath;

    const lastAnchor = currentAnchors[currentAnchors.length - 1];
    const firstAnchor = currentAnchors[0];

    // Compute closing segment
    const closingResult = findEnvelopePathFromPoints([lastAnchor, firstAnchor], contactDisks);

    Logger.debug('KnotState', 'Closing segment', {
      from: `(${lastAnchor.x.toFixed(2)},${lastAnchor.y.toFixed(2)})`,
      to: `(${firstAnchor.x.toFixed(2)},${firstAnchor.y.toFixed(2)})`,
      segments: closingResult.path.length,
    });

    if (closingResult.path.length > 0) {
      return [...knotPath, ...closingResult.path];
    }
    return knotPath;
  }, [knotPath, currentAnchors, contactDisks]);

  const toggleDisk = useCallback(
    (diskId: string) => {
      setDiskSequence((prev) => {
        if (prev.length > 0 && prev[prev.length - 1] === diskId) {
          // Remove last
          setTimeout(() => {
            setLastAnchorPoint(null);
            setAnchorSequence((prevA) => prevA.slice(0, -1));
            setChiralities((prevC) => prevC.slice(0, -1));
          }, 0);
          return prev.slice(0, -1);
        }
        // Add new
        setTimeout(() => {
          setChiralities((prevC) => [...prevC, 'L']); // Default to Left
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

  // Point-based extension (Strict Point-to-Point)
  const extendSequenceWithPoint = useCallback(
    (diskId: string, point: { x: number; y: number }) => {
      // Redundancy Check: Prevent infinite loops from duplicate events
      if (lastAnchorPoint) {
        const dist = Math.sqrt(
          Math.pow(point.x - lastAnchorPoint.x, 2) + Math.pow(point.y - lastAnchorPoint.y, 2),
        );
        if (dist < 1.0) {
          Logger.warn('KnotState', 'Duplicate Point Extension Ignored', { diskId, point, dist });
          return;
        }
      }

      // Find disk to calculate angle
      const disk = blocks.find((b) => b.id === diskId);
      if (!disk) return;

      const angle = Math.atan2(point.y - disk.center.y, point.x - disk.center.x);

      setAnchorSequence((prev) => [...prev, { diskId, angle }]);
      setChiralities((prev) => [...prev, 'L']); // Default to Left

      // We still track diskSequence for metadata/UI feedback
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
    envelopePath, // [NEW] Proper closed path for saving
    chiralities: computationResult.chiralities,
    anchorPoints: currentAnchors, // [RENAMED] Absolute points for rendering
    anchorSequence, // [NEW] Raw dynamic anchors for persistence
    validation, // [NEW] Expose validation result,
    flexibleKnotPaths: computationResult.dubinsPaths, // [NEW] Expose Flexible Paths
    actions: {
      setMode,
      toggleMode,
      toggleDisk,
      setSequence: setDiskSequence,
      clearSequence,
      // [NEW] Allow setting anchors directly (for loading)
      setAnchorSequence,
      extendSequenceWithPoint,
      setDragging: setIsDragging,
      setChiralities, // [NEW] Allow setting chiralities directly
      undoLastAction,
    },
  };
}
