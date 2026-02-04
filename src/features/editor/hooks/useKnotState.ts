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
}

export function useKnotState({ blocks }: UseKnotStateProps) {
    const [mode, setMode] = useState<'hull' | 'knot'>('hull'); // 'hull' = off/hidden, 'knot' = active
    const [diskSequence, setDiskSequence] = useState<string[]>([]);
    const [chiralities, setChiralities] = useState<('L' | 'R')[]>([]); // LOCKED TOPOLOGY

    // 1. Build Graph (Memoized)
    const contactDisks = useMemo(() => blocks.map(d => ({
        id: d.id,
        center: d.center,
        radius: d.visualRadius,
        regionId: 'default'
    })), [blocks]);

    const graph = useMemo(() => buildBoundedCurvatureGraph(contactDisks), [contactDisks]);

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
            const constrained = findEnvelopePath(graph, diskSequence, chiralities);
            // If valid, return it.
            if (constrained.path.length > 0) {
                return constrained;
            }
            // If invalid (broken geometry), we might want to fall back or show broken.
            // For now, let's fall back to optimal (snap) to avoid empty screen, 
            // OR return empty to show "impossible". 
            // User requested "No quiero que cambie". If it cannot be maintained, 
            // maybe snapping is better than disappearing?
            // Let's try to maintain, if fail, fall back to optimal (re-solve).
            // return findEnvelopePath(graph, diskSequence); 
        }

        // DEFAULT: Find Optimal Path (Viterbi)
        // Used when adding disks or if constraints invalid
        return findEnvelopePath(graph, diskSequence);
    }, [graph, diskSequence, chiralities]);

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
        actions: {
            setMode,
            toggleMode,
            toggleDisk,
            clearSequence,
            applyTwist,
            applyPoke
        }
    };
}

