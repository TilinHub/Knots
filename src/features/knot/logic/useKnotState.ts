import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildBoundedCurvatureGraph, type EnvelopePathResult, type EnvelopeSegment, findEnvelopePath, findEnvelopePathFromPoints } from '../../../core/geometry/contactGraph';
import type { DubinsPath } from '../../../core/geometry/dubins'; // Fixed import
import type { CSDisk } from '../../../core/types/cs';
import { Logger } from '../../../core/utils/Logger';
import { validateNoObstacleIntersection, validateNoSelfIntersection } from '../../../core/validation/envelopeValidator';
import { EnvelopePathCalculator } from '../../dubins/logic/EnvelopePathCalculator';

interface UseKnotStateProps {
    blocks: CSDisk[]; // We need disks to build the graph
    obstacleSegments?: { p1: { x: number, y: number }, p2: { x: number, y: number } }[]; // [NEW] Obstacles
}

export interface DynamicAnchor {
    diskId: string;
    angle: number; // Angle relative to disk center
}

export function useKnotState({ blocks, obstacleSegments = [] }: UseKnotStateProps) {
    const [mode, setMode] = useState<'hull' | 'knot'>('hull'); // 'hull' = off/hidden, 'knot' = active
    const [diskSequence, setDiskSequence] = useState<string[]>([]);

    // [NEW] Dynamic Anchors (Stored as relative angles)
    const [anchorSequence, setAnchorSequence] = useState<DynamicAnchor[]>([]);

    // [FIX] Freeze anchors during drag to prevent deformation
    const [isDragging, setIsDragging] = useState(false);

    // [NEW] Lock refs for debouncing and preventing concurrent recalculations
    const recalcLockRef = useRef(false);
    const recalcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Legacy/Derivative
    const [chiralities, setChiralities] = useState<('L' | 'R')[]>([]);
    const [lastAnchorPoint, setLastAnchorPoint] = useState<{ x: number, y: number } | null>(null);

    // 1. Build Graph (Memoized)
    const contactDisks = useMemo(() => blocks.map(d => ({
        id: d.id,
        center: d.center,
        radius: d.visualRadius,
        regionId: 'default'
    })), [blocks]);

    // Cleanup sequence if disks are removed
    useEffect(() => {
        setDiskSequence(prev => {
            const next = prev.filter(id => blocks.some(b => b.id === id));
            if (next.length !== prev.length) {
                Logger.info('KnotState', 'Cleaned up disk sequence', { removed: prev.length - next.length });
            }
            return next;
        });
        setAnchorSequence(prev => prev.filter(a => blocks.some(b => b.id === a.diskId)));
    }, [blocks]);

    // [NEW] Recalculate Absolute Positions (Reactive to blocks moving)
    const currentAnchors = useMemo(() => {
        // Always update anchors to follow disks (Elastic Behavior)
        return anchorSequence.map(anchor => {
            const disk = blocks.find(b => b.id === anchor.diskId);
            if (!disk) return { x: 0, y: 0 };
            return {
                x: disk.center.x + disk.visualRadius * Math.cos(anchor.angle),
                y: disk.center.y + disk.visualRadius * Math.sin(anchor.angle)
            };
        });
    }, [anchorSequence, blocks]);

    // 2. Compute Path (Flexible Envelope + Legacy Fallback)
    const computationResult: EnvelopePathResult & { dubinsPaths?: DubinsPath[] } = useMemo(() => {
        if (currentAnchors.length < 2) return { path: [], chiralities: [] };

        // A. Legacy Path (for validation/compatibility)
        // Use the DYNAMICALLY updated positions or just points
        const legacyResult = findEnvelopePathFromPoints(currentAnchors, contactDisks);

        // B. Flexible Dubins Path (for rendering)
        // We need chiralities that match the "Natural" path found by the legacy solver.
        // If we just use default 'L', we might force a loop where a crossing was intended.

        const derivedChiralities = new Map<string, 'L' | 'R'>();

        legacyResult.path.forEach(seg => {
            // Type assertion to handle 'type' discriminator safely
            const s = seg as any;
            if (s.type === 'ARC') {
                if (s.diskId) derivedChiralities.set(s.diskId, s.chirality);
            } else if (['LSL', 'LSR', 'RSL', 'RSR'].includes(s.type)) {
                // Tangent Segment
                const type = s.type as string; // e.g. 'LSL'
                if (s.startDiskId && s.startDiskId !== 'point' && s.startDiskId !== 'start') {
                    derivedChiralities.set(s.startDiskId, type.charAt(0) as 'L' | 'R');
                }
                if (s.endDiskId && s.endDiskId !== 'point' && s.endDiskId !== 'end') {
                    derivedChiralities.set(s.endDiskId, type.charAt(2) as 'L' | 'R');
                }
            }
        });

        let dubinsPaths: DubinsPath[] = [];

        let fullChiralities: ('L' | 'R')[] = [];

        if (diskSequence.length >= 2) {
            const calculator = new EnvelopePathCalculator();

            // Use STATE chiralities if valid
            fullChiralities = diskSequence.map((id, i) => {
                // Priority: Derived (Geometry) > State (User Override) > Default 'L'
                if (derivedChiralities.has(id)) return derivedChiralities.get(id)!;
                if (chiralities.length === diskSequence.length) return chiralities[i];
                return 'L';
            });

            dubinsPaths = calculator.calculateKnotPath(
                blocks,
                diskSequence,
                fullChiralities,
                true // Closed
            );
        }

        Logger.debug('KnotState', 'Computed Flexible Envelope', { legacyLen: legacyResult.path.length, dubinsLen: dubinsPaths.length });

        return {
            ...legacyResult,
            dubinsPaths,
            chiralities: fullChiralities
        };
    }, [currentAnchors, contactDisks, blocks, diskSequence, chiralities]);

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

        // Only warn/correct if LEGACY path is broken. 
        // If Dubins path works, maybe we don't care? 
        // But anchorSequence is derived from path? No, anchorSequence DRIVES the path.

        Logger.warn('KnotState', 'Invalid Path Detected - Triggering Auto-Correction', {
            diskSeqLen: diskSequence.length,
            pathLen: computationResult.path.length,
            anchorsCount: anchorSequence.length
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

            elasticResult.path.forEach(seg => {
                if (!('startDiskId' in seg)) return; // Access safely?
                // EnvelopeSegment types: Line | Arc. line has start/end. 
                // cast to any to access startDiskId if it exists on some variant
                const s = seg as any;
                const diskId = s.startDiskId || s.diskId;

                if (!diskId || diskId === 'start' || diskId === 'end' || diskId === 'point') return;
                if (seenDisks.has(diskId)) return;

                const disk = blocks.find(b => b.id === diskId && b.kind === 'disk');
                if (!disk) return;

                // Angle from disk center to segment start
                const startPt = s.type === 'ARC' ?
                    { x: disk.center.x + disk.visualRadius * Math.cos(s.startAngle), y: disk.center.y + disk.visualRadius * Math.sin(s.startAngle) }
                    : s.start;

                const angle = Math.atan2(startPt.y - disk.center.y, startPt.x - disk.center.x);

                newAnchors.push({ diskId, angle });
                seenDisks.add(diskId);
            });

            if (newAnchors.length < 2) {
                Logger.error('KnotState', 'Auto-Correction Failed: Insufficient anchors extracted', { count: newAnchors.length });
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
        isDragging,                      // Trigger cuando termina drag
        diskSequence.length,             // Solo longitud, no array completo
        computationResult.path.length,   // Solo longitud
        contactDisks // dep needed
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

    const toggleDisk = useCallback((diskId: string) => {
        setDiskSequence(prev => {
            if (prev.length > 0 && prev[prev.length - 1] === diskId) {
                // Remove last
                setLastAnchorPoint(null);
                setAnchorSequence(prevA => prevA.slice(0, -1));
                setChiralities(prevC => prevC.slice(0, -1));
                return prev.slice(0, -1);
            }
            // Add new
            setChiralities(prevC => [...prevC, 'L']); // Default to Left
            return [...prev, diskId];
        });
    }, []);

    const toggleMode = useCallback(() => {
        setMode(prev => prev === 'hull' ? 'knot' : 'hull');
    }, []);

    const clearSequence = useCallback(() => {
        setDiskSequence([]);
        setChiralities([]);
        setAnchorSequence([]);
        setLastAnchorPoint(null);
    }, []);

    // Point-based extension (Strict Point-to-Point)
    const extendSequenceWithPoint = useCallback((diskId: string, point: { x: number, y: number }) => {
        // Redundancy Check: Prevent infinite loops from duplicate events
        if (lastAnchorPoint) {
            const dist = Math.sqrt(Math.pow(point.x - lastAnchorPoint.x, 2) + Math.pow(point.y - lastAnchorPoint.y, 2));
            if (dist < 1.0) { // 1px tolerance
                Logger.warn('KnotState', 'Duplicate Point Extension Ignored', { diskId, point, dist });
                return;
            }
        }

        // Find disk to calculate angle
        const disk = blocks.find(b => b.id === diskId);
        if (!disk) return;

        const angle = Math.atan2(point.y - disk.center.y, point.x - disk.center.x);

        setAnchorSequence(prev => [
            ...prev,
            { diskId, angle }
        ]);

        setChiralities(prev => [...prev, 'L']); // Default to Left

        // We still track diskSequence for metadata/UI feedback
        setDiskSequence(prev => {
            Logger.info('KnotState', 'Extended Sequence with Point', { diskId, point });
            return [...prev, diskId];
        });

        setLastAnchorPoint(point); // This might be slightly off if disk moves immediately, but acts as "last click"
    }, [blocks, lastAnchorPoint]);

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
            setChiralities // [NEW] Allow setting chiralities directly
        }
    };
}
