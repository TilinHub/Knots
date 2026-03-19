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
import { intersectsAnyDiskStrict, intersectsDisk } from '../../../core/geometry/envelope/collision';
import type { CSDisk } from '../../../core/types/cs';
import type { ContactDisk } from '../../../core/types/contactGraph';
import type { Point2D } from '../../../core/types/cs';
import { recomputeElasticPath } from '../../../core/algorithms/pointPathSearch';
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

  // 2. Compute Path
  // During drag: use elastic recomputation (preserves topology, only stretches/contracts).
  // At rest: run full A* search to find optimal path.
  const computationResult: EnvelopePathResult & { dubinsPaths?: DubinsPath[] } = useMemo(() => {
    if (currentAnchors.length < 2) return { path: [], chiralities: [] };

    // Elastic mode: recompute from locked chiralities without A* search
    if (isDragging && lockedChiralities.length === diskSequence.length && diskSequence.length >= 2) {
      const elastic = recomputeElasticPath(diskSequence, contactDisks, lockedChiralities);
      if (elastic) {
        return elastic;
      }
      // Fallback to full search if elastic fails (degenerate geometry)
    }

    const result = findEnvelopePathFromPoints(currentAnchors, contactDisks, undefined, diskSequence);

    // Derive chiralities from result (per-position, not per-diskId, to support multi-visit).
    // When a disk appears multiple times in the sequence, we must match each visit to the
    // correct outgoing tangent in path order — not just the first tangent from that disk.
    const fullChiralities: ('L' | 'R')[] = [];

    // Track which path segments have already been claimed by an earlier sequence position.
    const claimedSegmentIndices = new Set<number>();

    for (let seqIdx = 0; seqIdx < diskSequence.length; seqIdx++) {
      const diskId = diskSequence[seqIdx];
      let found = false;

      if (seqIdx < diskSequence.length - 1) {
        const nextDiskId = diskSequence[seqIdx + 1];
        // Find the FIRST unclaimed tangent that departs diskId toward nextDiskId.
        for (let pi = 0; pi < result.path.length; pi++) {
          if (claimedSegmentIndices.has(pi)) continue;
          const s = result.path[pi] as any;
          if (s.type !== 'ARC' && s.startDiskId === diskId && s.endDiskId === nextDiskId) {
            fullChiralities.push(s.type.charAt(0) as 'L' | 'R');
            claimedSegmentIndices.add(pi);
            found = true;
            break;
          }
        }
      }

      if (!found) {
        // Fallback: first unclaimed arc on this disk
        for (let pi = 0; pi < result.path.length; pi++) {
          if (claimedSegmentIndices.has(pi)) continue;
          const s = result.path[pi] as any;
          if (s.type === 'ARC' && s.diskId === diskId) {
            fullChiralities.push(s.chirality);
            claimedSegmentIndices.add(pi);
            found = true;
            break;
          }
        }
      }

      if (!found) {
        fullChiralities.push(chiralities[seqIdx] ?? 'L');
      }
    }

    return {
      path: result.path,
      chiralities: fullChiralities,
    };
  }, [currentAnchors, contactDisks, diskSequence, chiralities, isDragging, lockedChiralities]);

  // Universal visual-radius disks for validation
  // ALWAYS uses visualRadius regardless of ribbonMode — the rendered green disks
  // are at visualRadius, so tangent lines must never cross them visually.
  const visualDisks: ContactDisk[] = useMemo(
    () => blocks.map((d) => ({
      id: d.id,
      center: d.center,
      radius: d.visualRadius,
      regionId: 'default',
    })),
    [blocks],
  );

  // Post-validate path against visual disk boundaries — ALWAYS, not just ribbon mode.
  // This is the final gate: no tangent segment may cross any visual disk.
  const validatedPath = useMemo(() => {
    if (computationResult.path.length === 0) return computationResult.path;

    const filtered = computationResult.path.filter((seg: EnvelopeSegment) => {
      if (seg.type === 'ARC') return true;
      const tan = seg as TangentSegment;
      return !intersectsAnyDiskStrict(tan.start, tan.end, visualDisks, tan.startDiskId, tan.endDiskId);
    });

    if (filtered.length !== computationResult.path.length) {
      Logger.warn('KnotState', 'Post-validation removed disk-crossing segments', {
        removed: computationResult.path.length - filtered.length,
      });
    }

    return filtered;
  }, [computationResult.path, visualDisks]);

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
      diskSequence.forEach((diskId, seqIdx) => {
        const disk = blocks.find((b) => b.id === diskId && b.kind === 'disk');
        if (!disk) return;

        const nextDiskId = seqIdx < diskSequence.length - 1 ? diskSequence[seqIdx + 1] : null;

        // 1. Prefer the specific outgoing tangent toward the next disk in the sequence.
        //    Using the departure point as anchor ensures the next computation starts at
        //    the departure → zero arc needed for segment (i → i+1), preventing double-arcs.
        if (nextDiskId) {
          const depSeg = lastElasticPathRef.current.find(
            (s: any) => s.type !== 'ARC' && s.startDiskId === diskId && s.endDiskId === nextDiskId,
          ) as TangentSegment | undefined;
          if (depSeg) {
            const angle = Math.atan2(depSeg.start.y - disk.center.y, depSeg.start.x - disk.center.x);
            newAnchors.push({ diskId, angle });
            return;
          }
        }

        // 2. Fallback: arc.endAngle (departure from arc), not startAngle (arrival).
        //    Using arrival as anchor caused double-arcs summing to ~360° when the
        //    stale anchor ended up on the wrong side of the disk after another disk moved.
        const arc = lastElasticPathRef.current.find((s: any) => s.type === 'ARC' && s.diskId === diskId) as ArcSegment | undefined;
        if (arc) {
          newAnchors.push({ diskId, angle: arc.endAngle });
          return;
        }

        // 3. Any outgoing tangent from this disk.
        const outTangent = lastElasticPathRef.current.find((s: any) => s.type !== 'ARC' && s.startDiskId === diskId) as TangentSegment | undefined;
        if (outTangent) {
          const angle = Math.atan2(outTangent.start.y - disk.center.y, outTangent.start.x - disk.center.x);
          newAnchors.push({ diskId, angle });
          return;
        }

        // 4. Last resort: incoming tangent endpoint.
        const inTangent = lastElasticPathRef.current.find((s: any) => s.type !== 'ARC' && s.endDiskId === diskId) as TangentSegment | undefined;
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

  const knotPath = validatedPath;

  const envelopePath = useMemo(() => {
    if (knotPath.length === 0 || currentAnchors.length < 3) return knotPath;

    const lastAnchor = currentAnchors[currentAnchors.length - 1];
    const firstAnchor = currentAnchors[0];

    // The closing path must not route through disks already used in the main sequence.
    // Only the first and last disk of the sequence are allowed as endpoints.
    const firstDiskId = diskSequence[0];
    const lastDiskId = diskSequence[diskSequence.length - 1];
    const closingForbiddenBase = new Set(
      diskSequence.slice(1, -1).filter(id => id !== firstDiskId && id !== lastDiskId),
    );

    // Exception: if a forbidden disk physically blocks the direct closing line,
    // it might be a necessary waypoint — remove it from the forbidden set so the
    // graph search can route around it.
    const closingForbidden = new Set(closingForbiddenBase);
    for (const id of closingForbiddenBase) {
      const d = contactDisks.find(cd => cd.id === id);
      if (d && intersectsDisk(lastAnchor, firstAnchor, d)) {
        closingForbidden.delete(id);
      }
    }

    const closingResult = findEnvelopePathFromPoints(
      [lastAnchor, firstAnchor],
      contactDisks,
      closingForbidden,
      [lastDiskId, firstDiskId],
    );

    if (closingResult.path.length > 0) {
      // Validate closing path against visual disks too
      const validClosing = closingResult.path.filter((seg: EnvelopeSegment) => {
        if (seg.type === 'ARC') return true;
        const tan = seg as TangentSegment;
        return !intersectsAnyDiskStrict(tan.start, tan.end, visualDisks, tan.startDiskId, tan.endDiskId);
      });
      if (validClosing.length > 0) {
        return [...knotPath, ...validClosing];
      }
    }
    return knotPath;
  }, [knotPath, currentAnchors, contactDisks, diskSequence, visualDisks]);

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
