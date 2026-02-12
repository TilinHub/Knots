import { useState, useMemo, useCallback } from 'react';
import { calculateDubinsPaths, checkPathCollision, calculateGeneralizedDubinsPaths, type Config, type DubinsType, type DubinsPath } from '../../../core/geometry/dubins';
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
            // Initialize Start Config to top of disk
            setStartConfig({
                x: disk.center.x,
                y: disk.center.y + disk.radius,
                theta: 0 // Will be tangential (0 is tangent at top? No, top normal is PI/2. Tangent is 0 or PI. 0 is Right.) 
                // Any valid tangent on boundary works.
            });

            if (endDiskId === disk.id) setEndDiskId(null);
        } else if (startDiskId === disk.id) {
            setStartDiskId(null);
            setStartConfig(null);
            setEndConfig(null);
            setEndDiskId(null);
        } else {
            setEndDiskId(disk.id);
            // Initialize End Config
            setEndConfig({
                x: disk.center.x,
                y: disk.center.y + disk.radius,
                theta: 0
            });
        }
    }, [startDiskId, endDiskId]);

    const computedPaths = useMemo(() => {
        let paths: DubinsPath[] = [];

        // Determine effective Start/End configs
        // If Disk is selected, we MUST have a startConfig snapped to it. 
        // If not yet set, we default to a point.
        // BUT we need to output the paths based on the *current* configs if they exist.

        // We need to know if we are in "Disk Mode" to enforce radii.
        const sDisk = startDiskId ? disks.find(d => d.id === startDiskId) : null;
        const eDisk = endDiskId ? disks.find(d => d.id === endDiskId) : null;

        if (sDisk && eDisk) {
            // If configs are null, we can't draw yet.
            // But UI should initialize them. 
            // Ideally we return empty, and useEffect sets default? 
            // Or calculate from default here if null?
            // Let's rely on the interaction to set them, OR infer them.
            // Infer: "Closest point to other disk".

            let sConf = startConfig;
            let eConf = endConfig;

            if (!sConf) {
                // Default: Point on sDisk line towards eDisk
                const angle = Math.atan2(eDisk.center.y - sDisk.center.y, eDisk.center.x - sDisk.center.x);
                sConf = {
                    x: sDisk.center.x + sDisk.radius * Math.cos(angle),
                    y: sDisk.center.y + sDisk.radius * Math.sin(angle),
                    theta: angle + Math.PI / 2 // Tangent CCW
                };
            }
            if (!eConf) {
                const angle = Math.atan2(sDisk.center.y - eDisk.center.y, sDisk.center.x - eDisk.center.x);
                eConf = {
                    x: eDisk.center.x + eDisk.radius * Math.cos(angle),
                    y: eDisk.center.y + eDisk.radius * Math.sin(angle),
                    theta: angle + Math.PI / 2
                };
            }

            // In Fixed-Center mode, calculateGeneralizedDubinsPaths determines the type based on the Start/End headings relative to the centers.
            // We pass the full Configurations (Point + Theta).

            // Map disks to {x,y,radius}
            const c1 = { x: sDisk.center.x, y: sDisk.center.y, radius: sDisk.radius };
            const c2 = { x: eDisk.center.x, y: eDisk.center.y, radius: eDisk.radius };

            // Calculate the SINGLE valid path for the current arrow configuration
            paths = calculateGeneralizedDubinsPaths(sConf, eConf, c1, c2);

            // Identify Obstacles
            const obstacles = disks
                .filter(d => d.id !== startDiskId && d.id !== endDiskId)
                .map(d => ({ x: d.center.x, y: d.center.y, radius: d.radius }));

            paths = paths.filter(p => !checkPathCollision(p, obstacles, 2));

        } else if (startConfig && endConfig) {
            // Manual Mode
            paths = calculateDubinsPaths(startConfig, endConfig, rho);
        }

        return paths.sort((a, b) => a.length - b.length);
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
