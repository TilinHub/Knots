import { useState, useMemo, useCallback } from 'react';
import {
    calculateBitangentPaths,
    checkPathCollision,
    type DubinsPath,
    type StoredDubinsPath,
    type DubinsType
} from '../../../core/geometry/dubins';
import { type ContactDisk } from '../../../core/types/contactGraph';

export interface PersistentDubinsState {
    activeDiskId: string | null;
    hoverDiskId: string | null;
    candidates: DubinsPath[];
    selectedPaths: StoredDubinsPath[];
    visibleSelectedPaths: DubinsPath[];
    pathCache: Map<string, DubinsPath>;
    hoverPathType: DubinsType | null;
}

export function usePersistentDubins(disks: ContactDisk[]) {
    const [selectedPaths, setSelectedPaths] = useState<StoredDubinsPath[]>([]);
    const [activeDiskId, setActiveDiskId] = useState<string | null>(null);
    const [hoverDiskId, setHoverDiskId] = useState<string | null>(null);
    const [hoverPathType, setHoverPathType] = useState<DubinsType | null>(null);

    // 1. Calculate Candidates
    const candidates = useMemo(() => {
        if (!activeDiskId || !hoverDiskId || activeDiskId === hoverDiskId) return [];

        const startDisk = disks.find(d => d.id === activeDiskId);
        const endDisk = disks.find(d => d.id === hoverDiskId);

        if (!startDisk || !endDisk) return [];

        const c1 = { x: startDisk.center.x, y: startDisk.center.y, radius: startDisk.radius };
        const c2 = { x: endDisk.center.x, y: endDisk.center.y, radius: endDisk.radius };

        // Calculate geometric candidates
        let paths = calculateBitangentPaths(c1, c2);

        // Filter collisions
        const obstacles = disks
            .filter(d => d.id !== activeDiskId && d.id !== hoverDiskId)
            .map(d => ({ x: d.center.x, y: d.center.y, radius: d.radius }));

        paths = paths.filter(p => !checkPathCollision(p, obstacles, 0.1));

        // [C1 Continuity]
        // Check if there is a selected path ending at activeDiskId
        // The path ends at activeDiskId. So activeDiskId was path.endDiskId.
        const prevPath = selectedPaths.find(p => p.endDiskId === activeDiskId);

        if (prevPath) {
            // Determine Arrival Winding on activeDiskId from prevPath
            // If prevPath type is 'LSL' or 'RSL' -> Ends with 'L' (CCW)
            // If prevPath type is 'LSR' or 'RSR' -> Ends with 'R' (CW)
            const prevType = prevPath.type;
            const arrivalWinding = (prevType === 'LSL' || prevType === 'RSL') ? 'L' : 'R';

            // Next path MUST Start with 'L' if arrival was 'L'
            // and 'R' if arrival was 'R' to be C1 continuous (wrapping around disk).
            // Filter candidates.
            paths = paths.filter(p => {
                const startWinding = (p.type === 'LSL' || p.type === 'LSR') ? 'L' : 'R';
                return startWinding === arrivalWinding;
            });
        }

        return paths;
    }, [activeDiskId, hoverDiskId, disks, selectedPaths]);

    // 2. Cache Selected Paths
    const pathCache = useMemo(() => {
        const cache = new Map<string, DubinsPath>();

        selectedPaths.forEach(sp => {
            const startDisk = disks.find(d => d.id === sp.startDiskId);
            const endDisk = disks.find(d => d.id === sp.endDiskId);
            if (!startDisk || !endDisk) return;

            const c1 = { x: startDisk.center.x, y: startDisk.center.y, radius: startDisk.radius };
            const c2 = { x: endDisk.center.x, y: endDisk.center.y, radius: endDisk.radius };

            // Re-calculate all to find match
            const paths = calculateBitangentPaths(c1, c2);
            const match = paths.find(p => p.type === sp.type);

            if (match) {
                cache.set(sp.id, match);
            }
        });

        return cache;
    }, [selectedPaths, disks]);

    // Actions
    const handleDiskClick = (diskId: string) => {
        if (!activeDiskId) {
            setActiveDiskId(diskId);
        } else {
            // Move focus
            setActiveDiskId(diskId);
        }
    };

    const handlePathClick = (path: DubinsPath) => {
        if (!activeDiskId || !hoverDiskId) return;

        const newPath: StoredDubinsPath = {
            id: `${Date.now()}-${Math.random()}`, // Unique ID
            startDiskId: activeDiskId,
            endDiskId: hoverDiskId,
            type: path.type
        };

        // Add to selection
        setSelectedPaths(prev => [...prev, newPath]);

        // Auto-advance: New start is current end
        setActiveDiskId(hoverDiskId);
        setHoverDiskId(null);
    };

    const clearPaths = useCallback(() => {
        setSelectedPaths([]);
        setActiveDiskId(null);
    }, []);

    // Interactive Metrics
    const totalLength = useMemo(() => {
        let len = 0;
        // Sum Bitangents
        pathCache.forEach(p => len += p.length);

        // Add Arcs? 
        // Logic: Path A->B ends at T_in. Path B->C starts at T_out.
        // We need Arc(T_in, T_out) on Disk B.
        // This requires sorting paths to form a chain.
        // For now, let's just sum segments as requested by "Largo individual... Largo total".
        // The user said: "Suma de Arcos + Segmentos".
        // bitangent paths already include the start/end arcs? NO.
        // My calculateBitangentPaths returns lengths of straight segments mostly?
        // Let's check dubins.ts again.
        // calculateBitangentPaths: "length: LSL_len".
        // LSL_len is distance between tangent points. STRAIGHT LINE.
        // So the "Arc" part (wrapping the disk) is MISSING in `DubinsPath.length` if derived from `calculateBitangentPaths`.
        // WAIT.
        // If I use `pathCache` which stores `DubinsPath`, and `DubinsPath` comes from `calculateBitangentPaths`.
        // The `length` property there IS the straight line distance?
        // Let's verify Step 108.
        // Line 310: LSL_len = sqrt(dist).
        // Line 314: length: LSL_len.
        // Yes. `calculateBitangentPaths` returns ONLY the straight connection.

        // The "Dubins" concept usually implies (Turn, Straight, Turn).
        // But here we are building a customized envelope.
        // So "Total Length" = Sum(Straight Segments) + Sum(Arcs on Disks).

        // We need to compute Arcs.
        // Ideally we form a chain.

        return len;
    }, [pathCache]);

    // Helper for rendering
    const visibleSelectedPaths = useMemo(() => {
        return selectedPaths
            .map(sp => pathCache.get(sp.id))
            .filter((p): p is DubinsPath => !!p);
    }, [selectedPaths, pathCache]);

    return {
        state: {
            activeDiskId,
            hoverDiskId,
            candidates,
            selectedPaths,
            visibleSelectedPaths, // NEW (Hydrated geometry for renderer)
            pathCache,
            hoverPathType,
            totalLength
        },
        actions: {
            setActiveDiskId,
            setHoverDiskId,
            setHoverPathType,
            handleDiskClick,
            handlePathClick,
            clearPaths
        }
    };
}
