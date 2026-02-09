import { useState, useMemo, useCallback, useEffect } from 'react';
import type { CSDisk } from '../../../core/types/cs';
import { useContactGraph } from '../hooks/useContactGraph'; // We need generating graph locally if not passed
import { findEnvelopePath, type EnvelopeSegment, buildBoundedCurvatureGraph } from '../../../core/geometry/contactGraph';
// Note: We need a way to get the ContactGraph inside here.
// Instead of complex dependency injection, we will ask for 'blocks' (passed in props)
// and build the graph internally like useContactPath does, or accept 'contactGraph' in arguments.
// To keep it simple and self-contained as requested, we'll derive it.

interface UseKnotStateProps {
    blocks: CSDisk[]; // We need disks to build the graph
    obstacleSegments?: { p1: { x: number, y: number }, p2: { x: number, y: number } }[]; // [NEW] Obstacles
}

export function useKnotState({ blocks, obstacleSegments = [] }: UseKnotStateProps) {
    const [mode, setMode] = useState<'hull' | 'knot'>('hull'); // 'hull' = off/hidden, 'knot' = active
    const [diskSequence, setDiskSequence] = useState<string[]>([]);
    const [chiralities, setChiralities] = useState<('L' | 'R')[]>([]); // LOCKED TOPOLOGY
    const [connectionStrategy, setConnectionStrategy] = useState<'auto' | 'outer' | 'inner'>('auto'); // [NEW]

    // 1. Build Graph (Memoized)
    const contactDisks = useMemo(() => blocks.map(d => ({
        id: d.id,
        center: d.center,
        radius: d.visualRadius,
        regionId: 'default'
    })), [blocks]);

    // Rebuild graph when obstacles or disks change
    const graph = useMemo(() => buildBoundedCurvatureGraph(contactDisks, true, obstacleSegments), [contactDisks, obstacleSegments]);

    // Cleanup sequence if disks are removed
    useEffect(() => {
        setDiskSequence(prev => prev.filter(id => blocks.some(b => b.id === id)));
    }, [blocks]);

    // 2. Compute Path (with Tangent Locking)
    const computationResult = useMemo(() => {
        if (!graph || diskSequence.length < 2) return { path: [], chiralities: [] };

        // IF we have a lock and it matches current sequence length, USE IT.
        // This preserves the topology while moving disks.
        if (chiralities.length === diskSequence.length) {
            const constrained = findEnvelopePath(graph, diskSequence, chiralities, connectionStrategy); // Pass strategy
            // If valid, return it.
            if (constrained.path.length > 0) {
                return constrained;
            }
        }

        // DEFAULT: Find Optimal Path (Viterbi)
        // Used when adding disks or if constraints invalid
        return findEnvelopePath(graph, diskSequence, undefined, connectionStrategy); // Pass strategy
    }, [graph, diskSequence, chiralities, connectionStrategy]); // Add dependency

    // 3. Sync Locked Chiralities
    // When the *Sequence* changes (length diff), we accept the new Optimal Chiralities as the new Lock.
    // When *Geometry* changes (same length), we DON'T update lock (handled by useMemo above using old lock).
    useEffect(() => {
        if (diskSequence.length < 2) {
            setChiralities([]);
            return;
        }

        // Only update lock if sequence topology definition changed (length mismatch)
        if (computationResult.chiralities.length === diskSequence.length) {
            if (chiralities.length !== diskSequence.length) {
                setChiralities(computationResult.chiralities);
            }
        }
    }, [computationResult, diskSequence, chiralities.length]);

    // Expose only the path to the UI
    const knotPath = computationResult.path;

    const toggleDisk = useCallback((diskId: string) => {
        setDiskSequence(prev => {
            if (prev.length > 0 && prev[prev.length - 1] === diskId) {
                return prev.slice(0, -1);
            }
            return [...prev, diskId];
        });
    }, []);

    const clearSequence = useCallback(() => {
        setDiskSequence([]);
        setChiralities([]);
    }, []);

    // Toggle Mode: Reset sequence when entering/exiting if desired
    const toggleMode = useCallback(() => {
        setMode(prev => {
            const next = prev === 'hull' ? 'knot' : 'hull';
            if (next === 'hull') {
                setDiskSequence([]);
                setChiralities([]);
            }
            return next;
        });
    }, []);

    const applyTwist = () => { }; // Legacy placeholder
    const applyPoke = () => { }; // Legacy placeholder

    return {
        mode,
        diskSequence,
        knotPath,
        chiralities: computationResult.chiralities, // EXPOSED FOR SAVING
        connectionStrategy, // [NEW]
        actions: {
            setMode,
            toggleMode,
            toggleDisk,
            setSequence: setDiskSequence, // [NEW] Expose direct setter
            clearSequence,
            applyTwist,
            applyPoke,
            setConnectionStrategy, // [NEW]
        }
    };
}

