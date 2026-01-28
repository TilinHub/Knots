import { useState, useMemo, useCallback } from 'react';
import { calculateDubinsPaths, checkPathCollision, calculateBitangentPaths, type Config, type DubinsType, type DubinsPath } from '../../../core/geometry/dubins';
import { type ContactDisk } from '../../../core/types/contactGraph';

export interface DubinsState {
    startConfig: Config | null;
    endConfig: Config | null;
    rho: number;
    visiblePaths: Set<DubinsType>;
    maxPathsToShow: number; // NEW
    computedPaths: DubinsPath[];
    mode: 'idle' | 'placingStart' | 'placingEnd';
}

export function useDubinsState(disks: ContactDisk[] = []) {
    const [isActive, setIsActive] = useState(false);
    const [startConfig, setStartConfig] = useState<Config | null>(null);
    const [endConfig, setEndConfig] = useState<Config | null>(null);
    const [rho, setRho] = useState<number>(50);
    const [visiblePaths, setVisiblePaths] = useState<Set<DubinsType>>(new Set(['LSL', 'RSR', 'LSR', 'RSL', 'RLR', 'LRL']));
    const [maxPathsToShow, setMaxPathsToShow] = useState<number>(6);

    // Disk Selection State
    const [startDiskId, setStartDiskId] = useState<string | null>(null);
    const [endDiskId, setEndDiskId] = useState<string | null>(null);

    // Local calculateTangentPaths removed. Using imported calculateBitangentPaths.

    const toggleMode = useCallback(() => {
        setIsActive(prev => {
            if (prev) {
                setStartDiskId(null);
                setEndDiskId(null);
                setStartConfig(null);
                setEndConfig(null);
                return false;
            }
            return true;
        });
    }, []);

    const handleDiskSelect = useCallback((disk: ContactDisk) => {
        if (!startDiskId) {
            setStartDiskId(disk.id);
            if (endDiskId === disk.id) setEndDiskId(null);
        } else if (startDiskId === disk.id) {
            setStartDiskId(null);
            setStartConfig(null);
            setEndConfig(null);
            setEndDiskId(null);
        } else {
            setEndDiskId(disk.id);
        }
    }, [startDiskId, endDiskId]);

    const computedPaths = useMemo(() => {
        let paths: DubinsPath[] = [];

        if (startDiskId && endDiskId) {
            const sDisk = disks.find(d => d.id === startDiskId);
            const eDisk = disks.find(d => d.id === endDiskId);
            if (sDisk && eDisk) {
                // Calculate Exact Bitangent Paths
                // We map ContactDisk to {x,y,radius}
                const c1 = { x: sDisk.center.x, y: sDisk.center.y, radius: sDisk.radius };
                const c2 = { x: eDisk.center.x, y: eDisk.center.y, radius: eDisk.radius };

                const rawPaths = calculateBitangentPaths(c1, c2);

                // Identify Obstacles: All disks except Start and End
                const obstacles = disks
                    .filter(d => d.id !== startDiskId && d.id !== endDiskId)
                    .map(d => ({ x: d.center.x, y: d.center.y, radius: d.radius }));

                // Filter paths that collide
                paths = rawPaths.filter(p => !checkPathCollision(p, obstacles, 2)); // Use small stepSize for precision
            }
        } else if (startConfig && endConfig) {
            // Manual Mode: No disk obstacles known unless we pass all disks?
            // For now, manual mode ignores obstacles (legacy behavior).
            paths = calculateDubinsPaths(startConfig, endConfig, rho);
        }

        return paths;
    }, [startConfig, endConfig, rho, startDiskId, endDiskId, disks]);

    const togglePathVisibility = useCallback((type: DubinsType) => {
        setVisiblePaths(prev => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    }, []);

    const setAllPathsVisibility = useCallback((visible: boolean) => {
        if (visible) {
            setVisiblePaths(new Set(['LSL', 'RSR', 'LSR', 'RSL', 'RLR', 'LRL']));
        } else {
            setVisiblePaths(new Set());
        }
    }, []);

    return {
        state: {
            isActive,
            startConfig,
            endConfig,
            rho,
            visiblePaths,
            maxPathsToShow,
            computedPaths,
            startDiskId, // NEW
            endDiskId    // NEW
        },
        actions: {
            toggleMode,
            setStartConfig,
            setEndConfig,
            setRho,
            setMaxPathsToShow,
            togglePathVisibility,
            setAllPathsVisibility,
            handleDiskSelect // NEW
        }
    };
}
