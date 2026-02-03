import { useState, useMemo, useCallback } from 'react';
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

    // 1. Build Graph (Memoized)
    // We map CSDisk to ContactDisk format expected by geometry functions
    const contactDisks = useMemo(() => blocks.map(d => ({
        id: d.id,
        center: d.center,
        radius: d.visualRadius,
        regionId: 'default'
    })), [blocks]);

    const graph = useMemo(() => buildBoundedCurvatureGraph(contactDisks), [contactDisks]);

    // 2. Compute Path
    const knotPath = useMemo(() => {
        if (!graph || diskSequence.length < 2) return [];
        return findEnvelopePath(graph, diskSequence);
    }, [graph, diskSequence]);

    // Actions
    const toggleDisk = useCallback((diskId: string) => {
        setDiskSequence(prev => {
            // Allow repeats for knots!
            // But maybe we want undo if clicking the *very last* one added?
            if (prev.length > 0 && prev[prev.length - 1] === diskId) {
                // If double clicking same disk, maybe remove it?
                // Or user wants to loop around same disk? 
                // For "undo" feel, clicking the last added one usually removes it.
                return prev.slice(0, -1);
            }
            return [...prev, diskId];
        });
    }, []);

    const clearSequence = useCallback(() => setDiskSequence([]), []);

    // Toggle Mode: Reset sequence when entering/exiting if desired
    const toggleMode = useCallback(() => {
        setMode(prev => {
            const next = prev === 'hull' ? 'knot' : 'hull';
            if (next === 'hull') setDiskSequence([]); // Clear when exiting
            return next;
        });
    }, []);

    const applyTwist = () => { }; // Legacy placeholder
    const applyPoke = () => { }; // Legacy placeholder

    return {
        mode,
        diskSequence,
        knotPath,
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

