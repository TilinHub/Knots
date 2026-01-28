import { useState, useMemo } from 'react';
import { type BoundedCurvatureGraph, findEnvelopePath, type EnvelopeSegment } from '../../../core/geometry/contactGraph';

export function useContactPath(graph: BoundedCurvatureGraph) {
    const [diskSequence, setDiskSequence] = useState<string[]>([]);

    const activePath: EnvelopeSegment[] = useMemo(() => {
        if (!graph || diskSequence.length < 2) return [];
        return findEnvelopePath(graph, diskSequence);
    }, [graph, diskSequence]);

    const toggleDisk = (diskId: string) => {
        setDiskSequence(prev => {
            // If already last, remove it (undo)
            if (prev.length > 0 && prev[prev.length - 1] === diskId) {
                return prev.slice(0, -1);
            }
            // Else append
            return [...prev, diskId];
        });
    };

    const clearSequence = () => setDiskSequence([]);

    return {
        diskSequence,
        activePath,
        toggleDisk,
        clearSequence
    };
}
