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

  // 2. Compute Path (Flexible Envelope + Legacy Fallback)
  const computationResult: EnvelopePathResult & { dubinsPaths?: DubinsPath[] } = useMemo(() => {
    if (currentAnchors.length < 2) return { path: [], chiralities: [] };

    let activeAnchors = currentAnchors;

    // [FIX] ELASTIC SOLVER OVERRIDE DURING DRAG
    // If the user is dragging, rigid anchor angles cause tangles.
    // Instead, we freeze the derived chiralities, use the topological solver to find the ideal "sliding"
    // anchor points, and then pass them to the point solver so it can route around obstacles.
    if (isDragging && diskSequence.length >= 2 && lockedChiralities.length === diskSequence.length) {
      // Build a collision-free graph to allow sliding over geometry without hallucinated inner tangencies
      const graph = buildBoundedCurvatureGraph(contactDisks, false, [], false);
      const elasticResult = findEnvelopePath(graph, diskSequence, lockedChiralities, false);

      if (elasticResult && elasticResult.path.length > 0) {
        const idealAnchors: { x: number; y: number }[] = [];
        diskSequence.forEach((diskId) => {
          const disk = contactDisks.find(d => d.id === diskId);
          if (!disk) return;

          const arc = elasticResult.path.find((s: any) => s.type === 'ARC' && s.diskId === diskId) as ArcSegment;
          if (arc) {
            idealAnchors.push({ x: disk.center.x + disk.radius * Math.cos(arc.startAngle), y: disk.center.y + disk.radius * Math.sin(arc.startAngle) });
            return;
          }
          const outT = elasticResult.path.find((s: any) => s.type !== 'ARC' && s.startDiskId === diskId) as TangentSegment;
          if (outT) {
            const angle = Math.atan2(outT.start.y - disk.center.y, outT.start.x - disk.center.x);
            idealAnchors.push({ x: disk.center.x + disk.radius * Math.cos(angle), y: disk.center.y + disk.radius * Math.sin(angle) });
            return;
          }
          const inT = elasticResult.path.find((s: any) => s.type !== 'ARC' && s.endDiskId === diskId) as TangentSegment;
          if (inT) {
            const angle = Math.atan2(inT.end.y - disk.center.y, inT.end.x - disk.center.x);
            idealAnchors.push({ x: disk.center.x + disk.radius * Math.cos(angle), y: disk.center.y + disk.radius * Math.sin(angle) });
            return;
          }
        });

        if (idealAnchors.length === diskSequence.length) {
          activeAnchors = idealAnchors;
        }
      }
    }

    // [CS PROTOCOL ENGINE] Mathematical Evolution
    if (isDragging && diskSequence.length >= 2 && csStateRef.current) {

      // Calculate continuous deltas
      const currentDisksMap = new Map<string, Point2D>();
      contactDisks.forEach(d => currentDisksMap.set(d.id, d.center));

      const targetDisplacements = new Map<string, Point2D>();
      currentDisksMap.forEach((center, id) => {
        const prev = prevDisksRef.current.get(id);
        if (prev) {
          targetDisplacements.set(id, { x: center.x - prev.x, y: center.y - prev.y } as Point2D);
        } else {
          targetDisplacements.set(id, { x: 0, y: 0 } as Point2D);
        }
      });

      // Request Solver Delta 
      const deltaResult = solveCSDiagramDelta(csStateRef.current, targetDisplacements);

      // If valid continuous projection available, try moving, else transition
      if (deltaResult) {
        // Generate theoretical pushed disks
        const theoreticalDisks = new Map<string, Point2D>();
        csStateRef.current.disks.forEach(d => {
          const disp = deltaResult.deltaC.get(d.id) || { x: 0, y: 0 };
          theoreticalDisks.set(d.id, { x: d.center.x + disp.x, y: d.center.y + disp.y });
        });

        // Validate and Jump if constraints broken
        csStateRef.current = transitionCSDiagramState(
          csStateRef.current,
          theoreticalDisks, // Apply our projection target (not actual mouse, strictly mapped)
          lockedChiralities,
          diskSequence
        );
      } else {
        // Forced Jump due to unsolvable matrix (e.g. overlapping disks)
        csStateRef.current = transitionCSDiagramState(
          csStateRef.current,
          currentDisksMap,
          lockedChiralities,
          diskSequence
        );
      }

      // Sync refs
      prevDisksRef.current = currentDisksMap;

      // Build output path from rigorous state
      const strictPath = convertStateToPath(csStateRef.current);

      if (strictPath && strictPath.length > 0) {
        const parsedAnchors: { x: number; y: number }[] = [];
        strictPath.forEach(s => {
          if (s.type === 'ARC') {
            const a = s as ArcSegment;
            parsedAnchors.push({ x: a.center.x + a.radius * Math.cos(a.startAngle), y: a.center.y + a.radius * Math.sin(a.startAngle) });
          }
        });
        if (parsedAnchors.length === diskSequence.length) {
          activeAnchors = parsedAnchors;
        }

        // Return bypassing legacy pathing
        return {
          path: strictPath,
          chiralities: lockedChiralities,
          dubinsPaths: [], // To be populated or rely directly on strict
        };
      }
    }

    // A. Legacy Base Path (for initial construction and stable states)
    // Uses the DYNAMICALLY updated positions or just points
    const legacyResult = findEnvelopePathFromPoints(activeAnchors, contactDisks);

    // [CS PROTOCOL] Snapshot — SOLO si el path tiene discos reales (no puntos libres)
    // findEnvelopePathFromPoints genera segmentos con sentinel IDs ('start','end','point')
    // que no corresponden a discos en state.disks → createMathematicalStateFromPath falla.
    const pathHasRealDisks = legacyResult.path.some((seg: any) => {
      if (seg.type === 'ARC') return diskSequence.includes(seg.diskId);
      return (
        seg.startDiskId != null &&
        seg.endDiskId != null &&
        diskSequence.includes(seg.startDiskId) &&
        diskSequence.includes(seg.endDiskId)
      );
    });

    if (!isDragging && legacyResult.path.length > 0 && diskSequence.length > 1 && pathHasRealDisks) {
      const dMap = new Map<string, any>();
      contactDisks.forEach(d => dMap.set(d.id, d));
      const strictState = createMathematicalStateFromPath(legacyResult.path, dMap, diskSequence);
      if (strictState) {
        csStateRef.current = strictState;
        contactDisks.forEach(d => prevDisksRef.current.set(d.id, d.center));
      }
    }

    // B. Flexible Dubins Path (for rendering)
    // We need chiralities that match the "Natural" path found by the legacy solver.
    // If we just use default 'L', we might force a loop where a crossing was intended.

    const derivedChiralities = new Map<string, 'L' | 'R'>();

    legacyResult.path.forEach((seg) => {
      // Type assertion to handle 'type' discriminator safely
      const s = seg as any;
      if (s.type === 'ARC') {
        if (s.diskId && !derivedChiralities.has(s.diskId)) {
          derivedChiralities.set(s.diskId, s.chirality);
        }
      } else if (['LSL', 'LSR', 'RSL', 'RSR'].includes(s.type)) {
        // Tangent Segment
        const type = s.type as string; // e.g. 'LSL'
        if (s.startDiskId && s.startDiskId !== 'point' && s.startDiskId !== 'start' && !derivedChiralities.has(s.startDiskId)) {
          derivedChiralities.set(s.startDiskId, type.charAt(0) as 'L' | 'R');
        }
        if (s.endDiskId && s.endDiskId !== 'point' && s.endDiskId !== 'end' && !derivedChiralities.has(s.endDiskId)) {
          derivedChiralities.set(s.endDiskId, type.charAt(2) as 'L' | 'R');
        }
      } else if (s.type.startsWith('PTD-')) {
        const type = s.type as string;
        if (s.endDiskId && s.endDiskId !== 'point' && s.endDiskId !== 'end' && !derivedChiralities.has(s.endDiskId)) {
          derivedChiralities.set(s.endDiskId, type.charAt(4) as 'L' | 'R');
        }
      } else if (s.type.startsWith('DTP-')) {
        const type = s.type as string;
        if (s.startDiskId && s.startDiskId !== 'point' && s.startDiskId !== 'start' && !derivedChiralities.has(s.startDiskId)) {
          derivedChiralities.set(s.startDiskId, type.charAt(4) as 'L' | 'R');
        }
      }
    });

    let dubinsPaths: DubinsPath[] = [];

    let fullChiralities: ('L' | 'R')[] = [];

    // Always compute Dubins to prevent visual glitches/tangles (Image 2) during drag
    if (diskSequence.length >= 2) {
      const calculator = new EnvelopePathCalculator();

      if (isDragging && lockedChiralities.length === diskSequence.length) {
        fullChiralities = lockedChiralities;
      } else {
        // Use STATE chiralities if valid
        fullChiralities = diskSequence.map((id, i) => {
          // Priority: Derived (Geometry) > State (User Override) > Default 'L'
          if (derivedChiralities.has(id)) return derivedChiralities.get(id)!;
          if (chiralities.length === diskSequence.length) return chiralities[i];
          return 'L';
        });
      }

      // Create a mapped array of CSDisks with the overwritten radius for Dubins
      const mathDisks: CSDisk[] = contactDisks.map(d => {
        const original = blocks.find(b => b.id === d.id);
        return {
          ...(original as CSDisk),
          visualRadius: d.radius, // Pass the mathematically exact radius
        };
      });

      dubinsPaths = calculator.calculateKnotPath(
        mathDisks,
        diskSequence,
        fullChiralities,
        true, // Closed
      );
    }

    Logger.debug('KnotState', 'Computed Flexible Envelope', {
      legacyLen: legacyResult.path.length,
      dubinsLen: dubinsPaths.length,
    });

    return {
      path: legacyResult.path,
      chiralities: fullChiralities,
      dubinsPaths
    };
  }, [currentAnchors, contactDisks, blocks, diskSequence, chiralities, isDragging, lockedChiralities]);

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

      const elasticResult = findEnvelopePath(graph, diskSequence, undefined, false);

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
    if (knotPath.length === 0 || currentAnchors.length < 3) return knotPath; // Need at least 3 points to form a non-trivial loop

    const lastAnchor = currentAnchors[currentAnchors.length - 1];
    const firstAnchor = currentAnchors[0];

    // Compute closing segment
    // We use the same finding logic as the main path
    const closingResult = findEnvelopePathFromPoints([lastAnchor, firstAnchor], contactDisks);

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
